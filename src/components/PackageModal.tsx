import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Package, Room } from '../types';
import { useWorkspaceStore } from '../store';
import { DEFAULT_BOOKABLE_ROOMS } from '../services/pricingService';
import {
  Package as PackageIcon,
  Clock,
  Banknote,
  AlignLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  DoorOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface PackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pkg: Omit<Package, 'id' | 'createdAt'>) => Promise<void>;
  editingPackage?: Package;
}

export function PackageModal({
  isOpen,
  onClose,
  onSave,
  editingPackage,
}: PackageModalProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language.startsWith('ar');
  const { rooms, settings } = useWorkspaceStore();

  const availableRooms = useMemo(() => {
    const list: Room[] = (rooms && rooms.length > 0) 
      ? rooms 
      : (settings.rooms && settings.rooms.length > 0 ? settings.rooms : DEFAULT_BOOKABLE_ROOMS);
    
    // Also include Shared Space option if not explicitly in list
    const hasShared = list.some(r => r.id === 'shared_space' || r.type === 'shared_space');
    if (!hasShared) {
      return [
        { id: 'shared_space', name: 'Shared Space (مساحة مشتركة)', pricePerHour: 30, capacity: 50, tables: [], active: true },
        ...list.filter(r => r.active !== false)
      ];
    }
    return list.filter(r => r.active !== false);
  }, [rooms, settings.rooms]);

  const defaultRoom = availableRooms[0] || { id: 'room-office-2', name: 'Office 2' };

  const [formData, setFormData] = useState({
    name: '',
    totalHours: 0,
    price: 0,
    validityDays: 30,
    isActive: true,
    description: '',
    roomId: defaultRoom.id,
    roomName: defaultRoom.name,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingPackage) {
      setFormData({
        name: editingPackage.name,
        totalHours: editingPackage.totalHours,
        price: editingPackage.price,
        validityDays: editingPackage.validityDays || 30,
        isActive: editingPackage.isActive,
        description: (editingPackage as any).description || '',
        roomId: editingPackage.roomId || defaultRoom.id,
        roomName: editingPackage.roomName || defaultRoom.name,
      });
    } else {
      setFormData({ 
        name: '', 
        totalHours: 0, 
        price: 0, 
        validityDays: 30, 
        isActive: true, 
        description: '',
        roomId: defaultRoom.id,
        roomName: defaultRoom.name,
      });
    }
  }, [editingPackage, isOpen, defaultRoom.id, defaultRoom.name]);

  const handleRoomChange = (selectedId: string) => {
    const targetRoom = availableRooms.find(r => r.id === selectedId);
    if (targetRoom) {
      setFormData(prev => ({
        ...prev,
        roomId: targetRoom.id,
        roomName: targetRoom.name
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] p-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl">

        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
              <PackageIcon className="w-4 h-4 text-cyan-500" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900 dark:text-white leading-tight">
                {editingPackage ? t('packages.edit') : t('packages.add')}
              </DialogTitle>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {editingPackage ? 'Update package details' : 'Create a new hours package'}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('packages.name')}
              </Label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. 20 Hours Office 2"
                className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 text-sm transition-all"
              />
            </div>

            {/* Linked Room Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <DoorOpen className="w-3.5 h-3.5 text-cyan-500" />
                <span>{isRTL ? 'الغرفة المرتبطة بالباقة (مطلوب)' : 'Linked Room (Required)'}</span>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableRooms.map((r) => {
                  const isSelected = formData.roomId === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleRoomChange(r.id)}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center gap-2",
                        isRTL && "text-right flex-row-reverse justify-between",
                        isSelected
                          ? "bg-cyan-500/10 border-cyan-500 text-cyan-700 dark:text-cyan-300 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-cyan-500/40"
                      )}
                    >
                      <DoorOpen className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-cyan-500" : "text-slate-400")} />
                      <span className="truncate">{r.name}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                {isRTL 
                  ? `هذه الباقة ستكون صالحة للاستخدام في غرفة (${formData.roomName}) فقط.` 
                  : `This package will only be redeemable in ${formData.roomName}.`}
              </p>
            </div>

            {/* Hours + Price + Validity Days */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-cyan-500" />
                  {t('packages.hours')}
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    required
                    min="1"
                    value={formData.totalHours || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, totalHours: parseFloat(e.target.value) })
                    }
                    className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 text-sm pr-10 transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400 pointer-events-none">
                    hrs
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Banknote className="w-3 h-3 text-emerald-500" />
                  {t('packages.price')}
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    required
                    min="0"
                    value={formData.price || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseFloat(e.target.value) })
                    }
                    className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 text-sm pr-12 transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400 pointer-events-none">
                    EGP
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-purple-500" />
                  الصلاحية (أيام)
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    required
                    min="1"
                    value={formData.validityDays || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, validityDays: parseInt(e.target.value) || 30 })
                    }
                    className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 text-sm pr-10 transition-all font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400 pointer-events-none">
                    يوم
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Days presets for packages */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-bold">صلاحية سريعة:</span>
              {[5, 10, 15, 20, 30, 60, 90].map((days) => (
                <button
                  key={`preset-${days}`}
                  type="button"
                  onClick={() => setFormData({ ...formData, validityDays: days })}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-lg border transition-all font-semibold",
                    formData.validityDays === days
                      ? "bg-purple-500 text-white border-purple-500 shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                  )}
                >
                  {days} يوم
                </button>
              ))}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <AlignLeft className="w-3 h-3 text-slate-400" />
                {t('common.description')}
                <span className="text-slate-300 dark:text-slate-600">
                  ({t('common.optional')})
                </span>
              </Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add some details about this package..."
                className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 text-sm min-h-[80px] resize-none transition-all"
              />
            </div>

            {/* ── Active Toggle ── */}
            <button
              type="button"
              onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200',
                formData.isActive
                  ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800',
              )}
            >
              {/* Left: icon + text */}
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200',
                    formData.isActive
                      ? 'bg-emerald-500/10'
                      : 'bg-slate-200/60 dark:bg-slate-700/60',
                  )}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {formData.isActive ? (
                      <motion.div
                        key="active"
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="inactive"
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <XCircle className="w-4 h-4 text-slate-400" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="text-left">
                  <p
                    className={cn(
                      'text-sm font-medium leading-tight transition-colors',
                      formData.isActive
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-600 dark:text-slate-400',
                    )}
                  >
                    {formData.isActive ? t('packages.active') : 'Inactive'}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {formData.isActive
                      ? t('packages.activeDesc')
                      : 'Hidden from customers'}
                  </p>
                </div>
              </div>

              {/* Right: pill toggle */}
              <div
                className={cn(
                  'relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0',
                  formData.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600',
                )}
              >
                <motion.div
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                  style={{ left: formData.isActive ? '18px' : '2px' }}
                />
              </div>
            </button>

          </div>

          {/* ── Footer ── */}
          <DialogFooter className="px-6 pb-6 pt-0 flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              {t('common.cancel')}
            </Button>

            <Button
              type="submit"
              disabled={loading}
              className={cn(
                'flex-[2] h-10 rounded-xl text-sm font-semibold transition-all duration-200',
                formData.isActive
                  ? 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-md shadow-cyan-500/20'
                  : 'bg-slate-700 hover:bg-slate-800 dark:bg-slate-200 dark:hover:bg-white text-white dark:text-slate-900',
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                {loading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t('common.saving')}
                  </motion.span>
                ) : (
                  <motion.span
                    key="save"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {t('common.save')}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </DialogFooter>
        </form>

      </DialogContent>
    </Dialog>
  );
}