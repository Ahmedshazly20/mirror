import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CreditCard, 
  Calculator, 
  TableProperties, 
  RotateCcw, 
  Check, 
  Sparkles, 
  Clock, 
  Building2, 
  Plus,
  Trash2,
  Edit2,
  Power,
  Layers,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Tag
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { WorkspaceSettings, SpaceTypeConfig } from '../../types';
import { 
  DEFAULT_PRICING_TABLE, 
  DEFAULT_SPACE_TYPES, 
  ROOM_TYPE_LABELS, 
  getEffectiveSpaceTypes,
  generateSpaceTypeKey,
  pricingService 
} from '../../services/pricingService';
import { toast } from 'sonner';

interface PricingSettingsSectionProps {
  localSettings: WorkspaceSettings;
  setLocalSettings: React.Dispatch<React.SetStateAction<WorkspaceSettings>>;
}

export function PricingSettingsSection({ localSettings, setLocalSettings }: PricingSettingsSectionProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language.startsWith('ar');

  // Space Types list
  const spaceTypes = useMemo(() => {
    return getEffectiveSpaceTypes(localSettings.spaceTypes);
  }, [localSettings.spaceTypes]);

  // Active space types for calculator
  const activeSpaceTypes = useMemo(() => {
    const activeOnly = spaceTypes.filter(st => st.active !== false);
    return activeOnly.length > 0 ? activeOnly : spaceTypes;
  }, [spaceTypes]);

  // Interactive Calculator State
  const [selectedSpace, setSelectedSpace] = useState<string>(() => {
    return activeSpaceTypes[0]?.key || 'meeting_room';
  });
  const [selectedHours, setSelectedHours] = useState<number>(3);

  // Active pricing matrix rules (fallbacks to DEFAULT_PRICING_TABLE)
  const currentPricingRules = useMemo(() => {
    return localSettings.pricingRules || DEFAULT_PRICING_TABLE;
  }, [localSettings.pricingRules]);

  // Direct calculation result
  const calculatedPrice = useMemo(() => {
    return pricingService.calculateRoomPrice(
      selectedSpace,
      selectedHours,
      currentPricingRules
    );
  }, [selectedSpace, selectedHours, currentPricingRules]);

  // Modal State for Adding Space Type
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTypeNameEn, setNewTypeNameEn] = useState('');
  const [newTypeNameAr, setNewTypeNameAr] = useState('');
  const [newTypeBasePrice, setNewTypeBasePrice] = useState<number>(100);

  // Modal State for Editing Space Type Name
  const [editingType, setEditingType] = useState<SpaceTypeConfig | null>(null);
  const [editNameEn, setEditNameEn] = useState('');
  const [editNameAr, setEditNameAr] = useState('');

  // Delete Confirmation State
  const [deletingTypeKey, setDeletingTypeKey] = useState<string | null>(null);

  // Handle cell edit in the pricing matrix
  const handleMatrixCellChange = (typeKey: string, hour: number, newPrice: number) => {
    const existingRules = localSettings.pricingRules || DEFAULT_PRICING_TABLE;
    const currentTypePrices = existingRules[typeKey] || DEFAULT_PRICING_TABLE[typeKey] || {};

    const updatedRules = {
      ...existingRules,
      [typeKey]: {
        ...currentTypePrices,
        [hour]: Math.max(0, newPrice),
      }
    };

    setLocalSettings({
      ...localSettings,
      pricingRules: updatedRules
    });
  };

  // Toggle Space Type Active / Inactive
  const handleToggleActive = (key: string) => {
    const updatedSpaceTypes = spaceTypes.map(st => {
      if (st.key === key) {
        return { ...st, active: !st.active };
      }
      return st;
    });

    setLocalSettings({
      ...localSettings,
      spaceTypes: updatedSpaceTypes
    });

    const target = updatedSpaceTypes.find(st => st.key === key);
    if (target?.active) {
      toast.success(isRTL ? `تم تفعيل نوع المساحة (${target.labelAr || target.labelEn})` : `Space type "${target.labelEn}" activated`);
    } else {
      toast.info(isRTL ? `تم تعطيل نوع المساحة (${target?.labelAr || target?.labelEn})` : `Space type "${target?.labelEn}" deactivated`);
    }
  };

  // Add New Space Type
  const handleAddSpaceType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeNameEn.trim() && !newTypeNameAr.trim()) {
      toast.error(isRTL ? 'يرجى إدخال اسم نوع المساحة' : 'Please enter a name for the space type');
      return;
    }

    const labelEn = newTypeNameEn.trim() || newTypeNameAr.trim();
    const labelAr = newTypeNameAr.trim() || newTypeNameEn.trim();
    const generatedKey = generateSpaceTypeKey(labelEn);

    // Check if key already exists
    if (spaceTypes.some(st => st.key === generatedKey)) {
      toast.error(isRTL ? 'نوع المساحة هذا موجود مسبقاً' : 'This space type already exists');
      return;
    }

    const newSpaceType: SpaceTypeConfig = {
      key: generatedKey,
      labelEn,
      labelAr,
      active: true,
      isDefault: false
    };

    // Calculate default proportional 1-8 hours prices based on base price
    const base = Number(newTypeBasePrice) || 100;
    const newPrices: Record<number, number> = {
      1: base,
      2: Math.round(base * 1.85),
      3: Math.round(base * 2.65),
      4: Math.round(base * 3.4),
      5: Math.round(base * 4.1),
      6: Math.round(base * 4.7),
      7: Math.round(base * 5.3),
      8: Math.round(base * 5.8),
    };

    const updatedSpaceTypes = [...spaceTypes, newSpaceType];
    const updatedRules = {
      ...(localSettings.pricingRules || DEFAULT_PRICING_TABLE),
      [generatedKey]: newPrices
    };

    setLocalSettings({
      ...localSettings,
      spaceTypes: updatedSpaceTypes,
      pricingRules: updatedRules
    });

    setSelectedSpace(generatedKey);
    setIsAddModalOpen(false);
    setNewTypeNameEn('');
    setNewTypeNameAr('');
    setNewTypeBasePrice(100);

    toast.success(isRTL ? `تمت إضافة نوع المساحة (${labelAr}) بنجاح` : `Space type "${labelEn}" added successfully`);
  };

  // Open Edit Dialog
  const handleOpenEdit = (st: SpaceTypeConfig) => {
    setEditingType(st);
    setEditNameEn(st.labelEn);
    setEditNameAr(st.labelAr);
  };

  // Save Edit Space Type Name
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingType) return;

    const labelEn = editNameEn.trim() || editingType.labelEn;
    const labelAr = editNameAr.trim() || editingType.labelAr;

    const updatedSpaceTypes = spaceTypes.map(st => {
      if (st.key === editingType.key) {
        return { ...st, labelEn, labelAr };
      }
      return st;
    });

    setLocalSettings({
      ...localSettings,
      spaceTypes: updatedSpaceTypes
    });

    setEditingType(null);
    toast.success(isRTL ? 'تم تحديث اسم نوع المساحة بنجاح' : 'Space type updated successfully');
  };

  // Delete Space Type
  const handleConfirmDelete = (key: string) => {
    const updatedSpaceTypes = spaceTypes.filter(st => st.key !== key);
    const existingRules = { ...(localSettings.pricingRules || DEFAULT_PRICING_TABLE) };
    delete existingRules[key];

    setLocalSettings({
      ...localSettings,
      spaceTypes: updatedSpaceTypes,
      pricingRules: existingRules
    });

    if (selectedSpace === key) {
      setSelectedSpace(updatedSpaceTypes[0]?.key || 'shared_space');
    }

    setDeletingTypeKey(null);
    toast.success(isRTL ? 'تم حذف نوع المساحة بنجاح' : 'Space type deleted successfully');
  };

  // Reset to the exact standard table from specifications
  const handleResetToDefaultTable = () => {
    setLocalSettings({
      ...localSettings,
      spaceTypes: DEFAULT_SPACE_TYPES,
      pricingRules: DEFAULT_PRICING_TABLE
    });
    setSelectedSpace('meeting_room');
    toast.success(isRTL ? 'تمت استعادة جدول الأسعار القياسي وأنواع المساحات الافتراضية' : 'Standard pricing table and default space types restored');
  };

  const hoursList = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── 1. Interactive Pricing Calculator (حاسبة الأسعار التفاعلية) ───────── */}
      <Card className="bg-gradient-to-br from-white via-slate-50/50 to-cyan-50/30 dark:from-slate-900 dark:via-slate-900/90 dark:to-cyan-950/20 border-cyan-500/20 dark:border-cyan-500/30 shadow-lg rounded-3xl overflow-hidden">
        <CardHeader className="p-6 md:p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-slate-900 dark:text-white">
                  {isRTL ? 'حاسبة نظام التسعير المباشر' : 'Interactive Pricing Calculator'}
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium">
                  {isRTL 
                    ? 'المصدر الوحيد المعتمد للأسعار: اختر نوع المساحة وعدد الساعات لعرض السعر الدقيق المحسوب من المصفوفة' 
                    : 'Single Source of Truth: Select space type and hours to instantly calculate the exact matrix price'}
                </CardDescription>
              </div>
            </div>

            <Badge variant="outline" className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 px-3 py-1 font-bold text-xs self-start sm:self-auto flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-500" />
              {isRTL ? 'مصدر التسعير المعتمد' : 'Single Source of Truth'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6 md:p-8 pt-6 space-y-6">
          
          {/* Step 1: Choose Space Type */}
          <div className="space-y-3">
            <Label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-cyan-500" />
              {isRTL ? '1. اختر نوع المساحة (Space Type):' : '1. Select Space Type:'}
            </Label>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {activeSpaceTypes.map((space) => {
                const isSelected = selectedSpace === space.key;
                return (
                  <button
                    key={space.key}
                    type="button"
                    onClick={() => setSelectedSpace(space.key)}
                    className={cn(
                      "p-3.5 rounded-2xl text-start transition-all border font-bold text-xs flex flex-col justify-between gap-2 relative overflow-hidden",
                      isSelected
                        ? "bg-cyan-500 text-white border-cyan-500 shadow-md shadow-cyan-500/20 ring-2 ring-cyan-500/30"
                        : "bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:border-cyan-500/50 hover:bg-cyan-50/50 dark:hover:bg-slate-800"
                    )}
                  >
                    <span className="font-extrabold text-sm">{space.labelEn}</span>
                    <span className={cn("text-[11px] font-medium", isSelected ? "text-cyan-100" : "text-slate-400")}>
                      {space.labelAr || ROOM_TYPE_LABELS[space.key]?.[isRTL ? 'ar' : 'en']}
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 left-2 rtl:left-auto rtl:right-2 w-2 h-2 rounded-full bg-white animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Choose Number of Hours */}
          <div className="space-y-3">
            <Label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-500" />
              {isRTL ? '2. اختر عدد الساعات (1 إلى 8 ساعات):' : '2. Select Duration (1 to 8 Hours):'}
            </Label>
            
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {hoursList.map((h) => {
                const isSelected = selectedHours === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSelectedHours(h)}
                    className={cn(
                      "py-3 rounded-2xl font-black text-sm transition-all border flex flex-col items-center justify-center gap-0.5",
                      isSelected
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md scale-105"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                    )}
                  >
                    <span className="text-base">{h}</span>
                    <span className="text-[10px] font-normal opacity-80">{isRTL ? (h === 1 ? 'ساعة' : 'ساعات') : 'Hour'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Result Calculation Banner */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-950 border border-cyan-500/30 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-center md:text-start">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {isRTL ? 'السعر النهائي المحدد في جدول التسعير' : 'Exact Calculated Price From Matrix'}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {spaceTypes.find(s => s.key === selectedSpace)?.labelEn || selectedSpace}
                  </span>
                  <span className="text-slate-400 font-bold">+</span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {selectedHours} {isRTL ? (selectedHours === 1 ? 'ساعة' : 'ساعات') : 'Hours'}
                  </span>
                  <span className="text-slate-400 font-bold">=</span>
                </div>
              </div>
            </div>

            <div className="flex items-baseline gap-2 bg-cyan-50 dark:bg-cyan-950/40 px-6 py-3.5 rounded-2xl border border-cyan-500/20">
              <span className="text-3xl md:text-4xl font-black text-cyan-600 dark:text-cyan-400 tracking-tight">
                {calculatedPrice}
              </span>
              <span className="text-sm font-extrabold text-cyan-600/80 dark:text-cyan-400/80">
                {t('common.currency')}
              </span>
            </div>
          </div>

        </CardContent>
      </Card>


      {/* ── 2. Space Types & Pricing Matrix Management (إدارة أنواع المساحات ومصفوفة التسعير) ──── */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="p-6 md:p-8 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <TableProperties className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-900 dark:text-white">
                {isRTL ? 'إدارة أنواع المساحات ومصفوفة التسعير (1 إلى 8 ساعات)' : 'Space Types & Pricing Matrix (1 to 8 Hours)'}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium">
                {isRTL 
                  ? 'أضف أنواع المساحات وعدّل أسعار الساعات (1-8) أو فعّل/عطّل نوع مساحة عند الحاجة' 
                  : 'Manage workspace types, edit 1-8h rates, activate/deactivate, or add custom space types'}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold gap-1.5 h-9 shadow-md shadow-cyan-500/10"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isRTL ? 'إضافة نوع مساحة جديد' : 'Add Space Type'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetToDefaultTable}
              className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 h-9"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isRTL ? 'استعادة القياسي' : 'Reset Table'}</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black">
                <th className="py-4 px-4 text-start sticky right-0 bg-slate-50 dark:bg-slate-800/90 z-10 border-e border-slate-200 dark:border-slate-700/60 min-w-[200px]">
                  {isRTL ? 'نوع المساحة' : 'Space Type'}
                </th>
                <th className="py-4 px-3 min-w-[80px] border-e border-slate-100 dark:border-slate-800 text-center">
                  {isRTL ? 'الحالة' : 'Status'}
                </th>
                {hoursList.map(h => (
                  <th key={h} className="py-4 px-3 min-w-[85px] border-e border-slate-100 dark:border-slate-800 last:border-e-0">
                    <span className="block text-sm font-black">{h} {isRTL ? 'س' : 'H'}</span>
                    <span className="text-[10px] font-medium text-slate-400">{h} {h === 1 ? 'Hour' : 'Hours'}</span>
                  </th>
                ))}
                <th className="py-4 px-3 min-w-[90px] text-center">
                  {isRTL ? 'إجراءات' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {spaceTypes.map((space) => {
                const isCurrentActive = selectedSpace === space.key;
                const isActive = space.active !== false;

                return (
                  <tr 
                    key={space.key}
                    className={cn(
                      "transition-colors",
                      !isActive ? "opacity-60 bg-slate-50/50 dark:bg-slate-900/40" : (
                        isCurrentActive 
                          ? "bg-cyan-50/40 dark:bg-cyan-950/20" 
                          : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      )
                    )}
                  >
                    {/* Space Type Name + Arabic Label */}
                    <td className="py-4 px-4 text-start font-black text-slate-900 dark:text-white sticky right-0 bg-white dark:bg-slate-900 z-10 border-e border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                            {space.labelEn}
                            {!isActive && (
                              <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-500">
                                {isRTL ? 'معطل' : 'Inactive'}
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            {space.labelAr || ROOM_TYPE_LABELS[space.key]?.[isRTL ? 'ar' : 'en']}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(space)}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-cyan-500 transition-colors"
                          title={isRTL ? 'تعديل الاسم' : 'Edit name'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Active/Inactive Toggle */}
                    <td className="py-3 px-2 border-e border-slate-100 dark:border-slate-800 text-center">
                      <div className="flex items-center justify-center">
                        <Switch
                          checked={isActive}
                          onCheckedChange={() => handleToggleActive(space.key)}
                          aria-label={isRTL ? 'تفعيل أو تعطيل' : 'Toggle active'}
                        />
                      </div>
                    </td>

                    {/* 1 to 8 Hours inputs */}
                    {hoursList.map(h => {
                      const priceVal = currentPricingRules[space.key]?.[h] ?? DEFAULT_PRICING_TABLE[space.key]?.[h] ?? 0;
                      const isHighlighted = isCurrentActive && selectedHours === h && isActive;

                      return (
                        <td 
                          key={h} 
                          className={cn(
                            "py-3 px-2 border-e border-slate-100 dark:border-slate-800 last:border-e-0 transition-all",
                            isHighlighted ? "bg-cyan-500/15" : ""
                          )}
                        >
                          <div className="flex items-center justify-center">
                            <Input
                              type="number"
                              disabled={!isActive}
                              value={priceVal}
                              onChange={(e) => handleMatrixCellChange(space.key, h, parseFloat(e.target.value) || 0)}
                              className={cn(
                                "w-20 h-9 text-center font-black text-sm rounded-xl border-transparent focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950 transition-all",
                                isHighlighted 
                                  ? "bg-cyan-500 text-white font-black shadow-sm" 
                                  : (isActive ? "bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-100" : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed")
                              )}
                            />
                          </div>
                        </td>
                      );
                    })}

                    {/* Actions Column */}
                    <td className="py-3 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingTypeKey(space.key)}
                          className="w-8 h-8 rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title={isRTL ? 'حذف نوع المساحة' : 'Delete space type'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>


      {/* ── 3. General Space Pricing Settings ─────────────────────────────────── */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="p-6 md:p-8 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-500/10 text-slate-500 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-900 dark:text-white">
                {t('settings.pricing')} ({isRTL ? 'معاملات التسعير العامة' : 'General Parameters'})
              </CardTitle>
              <CardDescription className="text-slate-500 font-medium">
                {t('settings.pricingDesc')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 md:p-8 pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('settings.firstHour')}
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={localSettings.pricing.firstHourPrice}
                  onChange={(e) => setLocalSettings({
                    ...localSettings,
                    pricing: { ...localSettings.pricing, firstHourPrice: parseFloat(e.target.value) || 0 }
                  })}
                  className="rounded-xl h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-black text-base"
                />
                <span className={cn("absolute top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400", isRTL ? "left-3" : "right-3")}>
                  {t('common.currency')}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('settings.secondHour')}
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={localSettings.pricing.secondHourPrice}
                  onChange={(e) => setLocalSettings({
                    ...localSettings,
                    pricing: { ...localSettings.pricing, secondHourPrice: parseFloat(e.target.value) || 0 }
                  })}
                  className="rounded-xl h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-black text-base"
                />
                <span className={cn("absolute top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400", isRTL ? "left-3" : "right-3")}>
                  {t('common.currency')}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('settings.dailyCap')}
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={localSettings.pricing.dailyCapPrice}
                  onChange={(e) => setLocalSettings({
                    ...localSettings,
                    pricing: { ...localSettings.pricing, dailyCapPrice: parseFloat(e.target.value) || 0 }
                  })}
                  className="rounded-xl h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-black text-base"
                />
                <span className={cn("absolute top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400", isRTL ? "left-3" : "right-3")}>
                  {t('common.currency')}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('settings.minCharge')}
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={localSettings.pricing.minChargeMinutes}
                  onChange={(e) => setLocalSettings({
                    ...localSettings,
                    pricing: { ...localSettings.pricing, minChargeMinutes: parseInt(e.target.value) || 0 }
                  })}
                  className="rounded-xl h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-black text-base"
                />
                <span className={cn("absolute top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400", isRTL ? "left-3" : "right-3")}>
                  {t('common.minutes')}
                </span>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>


      {/* ── Dialog: Add New Space Type ───────────────────────────────────────── */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-500" />
              {isRTL ? 'إضافة نوع مساحة جديد' : 'Add New Space Type'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              {isRTL 
                ? 'أدخل اسم المساحة وسعر الساعة الأولى ليتم توليد جدول أسعار 1 إلى 8 ساعات تلقائياً' 
                : 'Enter space type name and 1st hour rate to auto-generate a 1-8 hour pricing matrix'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSpaceType} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isRTL ? 'الاسم بالإنجليزية (e.g. Private Room)' : 'Name in English (e.g. Private Room)'}
              </Label>
              <Input
                placeholder="Private Room"
                value={newTypeNameEn}
                onChange={(e) => setNewTypeNameEn(e.target.value)}
                className="rounded-xl h-11 font-medium"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isRTL ? 'الاسم بالعربية (e.g. غرفة خاصة)' : 'Name in Arabic (e.g. غرفة خاصة)'}
              </Label>
              <Input
                placeholder="غرفة خاصة"
                value={newTypeNameAr}
                onChange={(e) => setNewTypeNameAr(e.target.value)}
                className="rounded-xl h-11 font-medium"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isRTL ? 'سعر الساعة الأولى (ج.م)' : '1st Hour Base Price (EGP)'}
              </Label>
              <Input
                type="number"
                min="1"
                value={newTypeBasePrice}
                onChange={(e) => setNewTypeBasePrice(parseFloat(e.target.value) || 0)}
                className="rounded-xl h-11 font-black text-base"
                required
              />
              <p className="text-[11px] text-slate-400">
                {isRTL ? '* يمكنك تعديل أسعار كل الساعات لاحقاً من الجدول مباشرة.' : '* You can fine-tune every hour price directly in the matrix table.'}
              </p>
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-xl"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-bold"
              >
                {isRTL ? 'إضافة وتثبيت بالجدول' : 'Add Space Type'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {/* ── Dialog: Edit Space Type Name ─────────────────────────────────────── */}
      <Dialog open={!!editingType} onOpenChange={(open) => !open && setEditingType(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-cyan-500" />
              {isRTL ? 'تعديل اسم نوع المساحة' : 'Edit Space Type Name'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isRTL ? 'الاسم بالإنجليزية' : 'Name in English'}
              </Label>
              <Input
                value={editNameEn}
                onChange={(e) => setEditNameEn(e.target.value)}
                className="rounded-xl h-11 font-medium"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isRTL ? 'الاسم بالعربية' : 'Name in Arabic'}
              </Label>
              <Input
                value={editNameAr}
                onChange={(e) => setEditNameAr(e.target.value)}
                className="rounded-xl h-11 font-medium"
                required
              />
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingType(null)}
                className="rounded-xl"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-bold"
              >
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      {/* ── Dialog: Delete Confirmation ─────────────────────────────────────── */}
      <Dialog open={!!deletingTypeKey} onOpenChange={(open) => !open && setDeletingTypeKey(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {isRTL ? 'تأكيد حذف نوع المساحة' : 'Confirm Deleting Space Type'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 pt-2">
              {isRTL 
                ? 'هل أنت متأكد من حذف هذا النوع من المساحات وجدول تسعيره؟ يمكنك أيضاً تعطيله بدلاً من حذفه.'
                : 'Are you sure you want to delete this space type and its pricing rules? You can also toggle it inactive instead of deleting.'}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingTypeKey(null)}
              className="rounded-xl"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deletingTypeKey && handleConfirmDelete(deletingTypeKey)}
              className="rounded-xl font-bold"
            >
              {isRTL ? 'نعم، احذف' : 'Yes, Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
