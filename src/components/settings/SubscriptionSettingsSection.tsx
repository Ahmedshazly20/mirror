import React from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, ShieldCheck, CalendarRange, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { WorkspaceSettings } from '../../types';

interface SubscriptionSettingsSectionProps {
  localSettings: WorkspaceSettings;
  setLocalSettings: React.Dispatch<React.SetStateAction<WorkspaceSettings>>;
}

export function SubscriptionSettingsSection({ localSettings, setLocalSettings }: SubscriptionSettingsSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2rem] overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-violet-500/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-900 dark:text-white">
                {t('settings.subsTitle')}
              </CardTitle>
              <CardDescription className="text-slate-500 font-medium">
                {t('settings.subsDesc')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-8 pt-4 space-y-6">
          {/* Main Toggle */}
          <div className="p-6 rounded-3xl bg-violet-500/5 border border-violet-500/10 flex items-center justify-between group transition-all hover:bg-violet-500/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                <ShieldCheck className="w-6 h-6 text-violet-500" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-base font-bold text-slate-900 dark:text-white">{t('common.active')}</Label>
                <p className="text-xs text-slate-500 font-medium">{t('settings.subsTitle')}</p>
              </div>
            </div>
            <Switch
              checked={localSettings.subscriptions.enabled}
              onCheckedChange={(checked) => setLocalSettings({
                ...localSettings,
                subscriptions: { ...localSettings.subscriptions, enabled: checked }
              })}
              className="data-[state=checked]:bg-violet-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group relative p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 transition-all hover:border-violet-500/30">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                  </div>
                  <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {t('settings.monthlyPrice')}
                  </Label>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    value={localSettings.subscriptions.monthlyPrice}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      subscriptions: { ...localSettings.subscriptions, monthlyPrice: parseFloat(e.target.value) || 0 }
                    })}
                    className="rounded-2xl h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-black text-lg focus:ring-violet-500/20 pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">EGP</span>
                </div>
              </div>
            </div>

            <div className="group relative p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 transition-all hover:border-violet-500/30">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                    <CalendarRange className="w-4 h-4 text-violet-500" />
                  </div>
                  <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {t('settings.durationDays')}
                  </Label>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    value={localSettings.subscriptions.durationDays}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      subscriptions: { ...localSettings.subscriptions, durationDays: parseInt(e.target.value) || 0 }
                    })}
                    className="rounded-2xl h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-black text-lg focus:ring-violet-500/20 pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">Days</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
