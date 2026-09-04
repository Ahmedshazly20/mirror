import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Save,
  Palette,
  CreditCard,
  Package,
  Layers,
  DoorOpen,
  Users,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useWorkspaceStore } from '../store';
import { settingsService } from '../services/settingsService';
import { WorkspaceSettings } from '../types';

import { GeneralSettingsSection } from '../components/settings/GeneralSettingsSection';
import { PricingSettingsSection } from '../components/settings/PricingSettingsSection';
import { ServicesSettingsSection } from '../components/settings/ServicesSettingsSection';
import { PackagesSettingsSection } from '../components/settings/PackagesSettingsSection';
import { RoomsSettingsSection } from '../components/settings/RoomsSettingsSection';
import { SubscriptionSettingsSection } from '../components/settings/SubscriptionSettingsSection';
import { StaffManagement } from '../components/StaffManagement';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { 
    settings, 
    setSettings, 
    availableServices, 
    packages, 
    user 
  } = useWorkspaceStore();
  
  const [localSettings, setLocalSettings] = useState<WorkspaceSettings>(settings);
  const [activeTab, setActiveTab] = useState('general');
  const isRTL = i18n.language.startsWith('ar');
  const isOwner = user?.role === 'owner';

  const handleSave = async () => {
    try {
      await settingsService.updateSettings(localSettings);
      setSettings(localSettings);
      toast.success(t('settings.saved'));
    } catch {
      toast.error(t('settings.saveError'));
    }
  };

  const menuItems = [
    { id: 'general', label: t('common.settings'), icon: SettingsIcon, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    { id: 'pricing', label: t('settings.tabs.pricing'), icon: CreditCard, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: 'services', label: t('settings.tabs.services'), icon: Layers, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { id: 'subscriptions', label: t('settings.tabs.subscriptions'), icon: CreditCard, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { id: 'packages', label: t('settings.tabs.packages'), icon: Package, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { id: 'rooms', label: t('settings.tabs.rooms'), icon: DoorOpen, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    ...(isOwner ? [{ id: 'staff', label: t('settings.tabs.staff'), icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' }] : []),
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'general': return <GeneralSettingsSection />;
      case 'pricing': return <PricingSettingsSection localSettings={localSettings} setLocalSettings={setLocalSettings} />;
      case 'services': return <ServicesSettingsSection localSettings={localSettings} setLocalSettings={setLocalSettings} availableServices={availableServices} />;
      case 'subscriptions': return <SubscriptionSettingsSection localSettings={localSettings} setLocalSettings={setLocalSettings} />;
      case 'packages': return <PackagesSettingsSection packages={packages} />;
      case 'rooms': return <RoomsSettingsSection localSettings={localSettings} setLocalSettings={setLocalSettings} />;
      case 'staff': return <StaffManagement />;
      default: return <GeneralSettingsSection />;
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-cyan-500/10 rounded-2xl shadow-inner">
            <SettingsIcon className="w-8 h-8 text-cyan-500" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('settings.title')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              {t('settings.subtitle')}
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2 rounded-2xl h-12 px-8 shadow-xl shadow-cyan-500/20 active:scale-95 transition-all"
        >
          <Save className="w-5 h-5" />
          <span className="font-bold">{t('settings.saveChanges')}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Modern Vertical Navigation */}
        <aside className="lg:col-span-3 space-y-2">
          <div className="bg-white dark:bg-slate-900 p-3 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <p className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              {t('common.dashboard')}
            </p>
            <nav className="space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-2xl transition-all group relative overflow-hidden",
                    activeTab === item.id 
                      ? "bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" 
                      : "text-slate-500 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                  )}
                >
                  <div className="flex items-center gap-3 z-10">
                    <div className={cn(
                      "p-2 rounded-xl transition-colors",
                      activeTab === item.id ? item.bg : "bg-slate-100 dark:bg-slate-800"
                    )}>
                      <item.icon className={cn("w-5 h-5", activeTab === item.id ? item.color : "text-slate-500")} />
                    </div>
                    <span className={cn("text-sm font-bold", activeTab === item.id ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400")}>
                      {item.label}
                    </span>
                  </div>
                  {activeTab === item.id && (
                    <div className="z-10">
                      {isRTL ? <ChevronLeft className="w-4 h-4 text-cyan-500" /> : <ChevronRight className="w-4 h-4 text-cyan-500" />}
                    </div>
                  )}
                  {activeTab === item.id && (
                    <motion.div 
                      initial={{ scaleY: 0, opacity: 0 }}
                      animate={{ scaleY: 1, opacity: 1 }}
                      className={cn(
                        "absolute inset-y-0 w-1 bg-cyan-500 rounded-full origin-center",
                        isRTL ? "right-0" : "left-0"
                      )}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-3xl text-white shadow-xl shadow-cyan-500/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
               <Palette className="w-24 h-24" />
            </div>
            <p className="text-xs font-bold opacity-80 uppercase tracking-wider mb-1">Status</p>
            <p className="text-lg font-black leading-tight">Workspace v2.1</p>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full" />
              <span className="text-[10px] font-bold opacity-90 uppercase">All systems operational</span>
            </div>
          </div>
        </aside>

        {/* Content Area with High Performance Animations */}
        <main className="lg:col-span-9">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: [0.215, 0.610, 0.355, 1.000] }}
              className="will-change-transform-opacity"
              style={{ willChange: 'transform, opacity' }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}