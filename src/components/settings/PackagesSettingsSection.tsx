import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Package as PackageIcon, Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Clock, Banknote, Sparkles, DoorOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package } from '../../types';
import { packageService } from '../../services/packageService';
import { PackageModal } from '../PackageModal';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface PackagesSettingsSectionProps {
  packages: Package[];
}

export function PackagesSettingsSection({ packages }: PackagesSettingsSectionProps) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | undefined>(undefined);

  const handleSave = async (pkgData: Omit<Package, 'id' | 'createdAt'>) => {
    try {
      if (editingPackage) {
        await packageService.updatePackage(editingPackage.id, pkgData);
        toast.success(t('common.success'));
      } else {
        await packageService.addPackage(pkgData);
        toast.success(t('common.success'));
      }
    } catch {
      toast.error(t('common.error'));
    }
  };

  const removePackage = async (id: string) => {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await packageService.deletePackage(id);
      toast.success(t('common.success'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const toggleStatus = async (pkg: Package) => {
    try {
      await packageService.updatePackage(pkg.id, { isActive: !pkg.isActive });
    } catch {
      toast.error(t('common.error'));
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2rem] overflow-hidden">
        <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <PackageIcon className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-900 dark:text-white">
                {t('packages.title')}
              </CardTitle>
              <CardDescription className="text-slate-500 font-medium font-medium">
                {t('packages.subtitle')}
              </CardDescription>
            </div>
          </div>
          <Button 
            onClick={() => {
              setEditingPackage(undefined);
              setIsModalOpen(true);
            }} 
            className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2 rounded-2xl h-11 px-6 shadow-xl shadow-cyan-500/10 font-bold transition-all"
          >
            <Plus className="w-4 h-4" />
            {t('packages.add')}
          </Button>
        </CardHeader>
        
        <CardContent className="p-8 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
            <AnimatePresence initial={false}>
              {packages.map((pkg) => (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileHover={{ y: -5 }}
                  className="group"
                >
                  <Card className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] overflow-hidden group hover:border-cyan-500/30 transition-all duration-500 shadow-sm hover:shadow-2xl">
                    <div className="p-7 space-y-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                           <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
                             <PackageIcon className={cn("w-6 h-6", pkg.isActive ? "text-cyan-500" : "text-slate-400")} />
                           </div>
                           <h3 className="font-black text-xl text-slate-900 dark:text-white group-hover:text-cyan-500 transition-colors tracking-tight">
                            {pkg.name}
                          </h3>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 font-bold text-xs py-0.5 px-2 rounded-lg flex items-center gap-1">
                              <DoorOpen className="w-3 h-3 text-cyan-500" />
                              <span>{pkg.roomName || 'Shared Space'}</span>
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <Badge className={cn(
                            "rounded-full px-3 py-0.5 text-[10px] uppercase font-black tracking-widest shadow-sm",
                            pkg.isActive 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                          )}>
                            {pkg.isActive ? t('common.active') : t('common.inactive')}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 shadow-inner">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-black tracking-widest truncate">
                            <Clock className="w-3 h-3 text-cyan-500 shrink-0" />
                            {t('packages.hours')}
                          </div>
                          <p className="text-lg font-black text-slate-900 dark:text-white leading-none">
                            {pkg.totalHours}<span className="text-xs font-bold text-slate-400 ml-1">H</span>
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-black tracking-widest truncate">
                            <Banknote className="w-3 h-3 text-emerald-500 shrink-0" />
                            {t('packages.price')}
                          </div>
                          <p className="text-lg font-black text-emerald-500 leading-none">
                            {pkg.price}<span className="text-xs font-bold text-slate-400 ml-1">EGP</span>
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-black tracking-widest truncate">
                            <Clock className="w-3 h-3 text-purple-500 shrink-0" />
                            الصلاحية
                          </div>
                          <p className="text-lg font-black text-purple-600 dark:text-purple-400 leading-none">
                            {pkg.validityDays || 30}<span className="text-xs font-bold text-slate-400 ml-1">يوم</span>
                          </p>
                        </div>
                      </div>

                      {pkg.description ? (
                        <p className="text-xs text-slate-500 font-medium line-clamp-2 min-h-[2.5rem] leading-relaxed">
                          {pkg.description}
                        </p>
                      ) : (
                         <div className="min-h-[2.5rem] flex items-center grayscale opacity-20">
                            <Sparkles className="w-5 h-5" />
                         </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-50 dark:border-slate-800/50">
                        <Button
                          variant="ghost"
                          onClick={() => toggleStatus(pkg)}
                          className={cn(
                            "flex-1 h-10 gap-2 rounded-xl text-[10px] font-black uppercase transition-all",
                            pkg.isActive 
                              ? 'text-cyan-600 bg-cyan-50 hover:bg-cyan-100' 
                              : 'text-slate-400 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800'
                          )}
                        >
                          {pkg.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                          {pkg.isActive ? t('common.active') : t('common.inactive')}
                        </Button>
                        <div className="flex gap-2">
                           <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              setEditingPackage(pkg);
                              setIsModalOpen(true);
                            }}
                            className="w-10 h-10 rounded-xl text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-slate-800 transition-all shadow-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removePackage(pkg.id)}
                            className="w-10 h-10 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all shadow-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {packages.length === 0 && (
              <div className="col-span-full text-center py-24 bg-slate-50/50 dark:bg-slate-900/30 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem]">
                <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <PackageIcon className="w-10 h-10 text-slate-200" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No Packages Exist</h3>
                <p className="text-slate-500 font-medium mb-8 max-w-[240px] mx-auto">Create value packages for your customers to enjoy better rates.</p>
                <Button 
                   onClick={() => setIsModalOpen(true)}
                   className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2 rounded-2xl h-12 px-8 font-bold shadow-lg shadow-cyan-500/20"
                >
                  <Plus className="w-5 h-5" />
                  Add New Package
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <PackageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        editingPackage={editingPackage}
      />
    </div>
  );
}
