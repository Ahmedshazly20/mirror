import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, Moon, Sun, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaceStore } from '../../store';
import { cn } from '@/lib/utils';

export function GeneralSettingsSection() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useWorkspaceStore();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2rem] overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-900 dark:text-white">
                {t('settings.generalTitle')}
              </CardTitle>
              <CardDescription className="text-slate-500 font-medium">
                {t('settings.generalDesc')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-8 pt-4 space-y-6">
          {/* Language Selection */}
          <div className="group relative p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/30 transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500">
                  <Globe className="w-6 h-6 text-cyan-500" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white mb-0.5">{t('settings.language')}</h4>
                  <p className="text-xs text-slate-500 font-medium max-w-[240px] leading-relaxed">{t('settings.languageDesc')}</p>
                </div>
              </div>
              <Select value={i18n.language} onValueChange={changeLanguage}>
                <SelectTrigger className="w-full sm:w-[160px] rounded-2xl h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold focus:ring-cyan-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl">
                  <SelectItem value="en" className="font-bold">English</SelectItem>
                  <SelectItem value="ar" className="font-bold">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Theme Selection */}
          <div className="group relative p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/30 transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500">
                  {theme === 'dark' ? <Moon className="w-6 h-6 text-indigo-500" /> : <Sun className="w-6 h-6 text-amber-500" />}
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white mb-0.5">{t('settings.appearance')}</h4>
                  <p className="text-xs text-slate-500 font-medium max-w-[240px] leading-relaxed">{t('settings.appearanceDesc')}</p>
                </div>
              </div>
              
              <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
                <Button
                  variant="ghost"
                  onClick={() => theme === 'dark' && toggleTheme()}
                  className={cn(
                    "flex-1 sm:flex-none rounded-xl h-10 px-6 gap-2 transition-all duration-300 font-bold",
                    theme === 'light' 
                      ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" 
                      : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <Sun className="w-4 h-4" />
                  <span className="text-xs">Light</span>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => theme === 'light' && toggleTheme()}
                  className={cn(
                    "flex-1 sm:flex-none rounded-xl h-10 px-6 gap-2 transition-all duration-300 font-bold",
                    theme === 'dark' 
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" 
                      : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <Moon className="w-4 h-4" />
                  <span className="text-xs">Dark</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
