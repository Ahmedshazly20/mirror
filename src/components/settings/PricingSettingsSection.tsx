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
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { WorkspaceSettings, RoomType } from '../../types';
import { 
  DEFAULT_PRICING_TABLE, 
  SUPPORTED_SPACE_TYPES, 
  ROOM_TYPE_LABELS, 
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

  // Interactive Calculator State
  const [selectedSpace, setSelectedSpace] = useState<RoomType>('meeting_room');
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

  // Handle cell edit in the pricing matrix
  const handleMatrixCellChange = (roomType: RoomType, hour: number, newPrice: number) => {
    const updatedRules = {
      ...(localSettings.pricingRules || DEFAULT_PRICING_TABLE),
      [roomType]: {
        ...((localSettings.pricingRules || DEFAULT_PRICING_TABLE)[roomType] || DEFAULT_PRICING_TABLE[roomType]),
        [hour]: newPrice,
      }
    };

    setLocalSettings({
      ...localSettings,
      pricingRules: updatedRules
    });
  };

  // Reset to the exact standard table from specifications
  const handleResetToDefaultTable = () => {
    setLocalSettings({
      ...localSettings,
      pricingRules: DEFAULT_PRICING_TABLE
    });
    toast.success(isRTL ? 'تمت استعادة جدول الأسعار المعتمد بنجاح' : 'Standard pricing table restored');
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
                    ? 'اختر نوع المساحة وعدد الساعات لعرض السعر الدقيق المحسوب مباشرة من جدول التسعير' 
                    : 'Select space type and hours to instantly display exact matrix price'}
                </CardDescription>
              </div>
            </div>

            <Badge variant="outline" className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 px-3 py-1 font-bold text-xs self-start sm:self-auto">
              EGP جدول تسعير معتمد
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
              {SUPPORTED_SPACE_TYPES.map((space) => {
                const isSelected = selectedSpace === space.key;
                return (
                  <button
                    key={space.key}
                    type="button"
                    onClick={() => setSelectedSpace(space.key)}
                    className={cn(
                      "p-3.5 rounded-2xl text-start transition-all border font-bold text-xs flex flex-col justify-between gap-2 relative overflow-hidden",
                      isSelected
                        ? "bg-cyan-500 text-white border-cyan-500 shadow-md shadow-cyan-500/20"
                        : "bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:border-cyan-500/50 hover:bg-cyan-50/50 dark:hover:bg-slate-800"
                    )}
                  >
                    <span className="font-extrabold text-sm">{space.labelEn}</span>
                    <span className={cn("text-[11px] font-medium", isSelected ? "text-cyan-100" : "text-slate-400")}>
                      {ROOM_TYPE_LABELS[space.key]?.[isRTL ? 'ar' : 'en']}
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 left-2 rtl:left-auto rtl:right-2 w-2 h-2 rounded-full bg-white" />
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
                  {isRTL ? 'السعر النهائي المحدد بالجدول' : 'Exact Calculated Price'}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                    {SUPPORTED_SPACE_TYPES.find(s => s.key === selectedSpace)?.labelEn}
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


      {/* ── 2. Full Pricing Matrix Table (جدول الأسعار الكامل لجميع المساحات) ──── */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="p-6 md:p-8 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <TableProperties className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-900 dark:text-white">
                {isRTL ? 'جدول تسعير المساحات الكامل (1 إلى 8 ساعات)' : 'Full Space Pricing Matrix (1 to 8 Hours)'}
              </CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium">
                {isRTL 
                  ? 'أسعار محددة لكل عدد ساعات لجميع أنواع المساحات السبعة (الأسعار بالجنيه المصري EGP)' 
                  : 'Fixed rates per duration bracket across all 7 workspace categories (in EGP)'}
              </CardDescription>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetToDefaultTable}
            className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold gap-1.5 h-9"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isRTL ? 'استعادة الجدول القياسي' : 'Reset to Standard Table'}</span>
          </Button>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black">
                <th className="py-4 px-4 text-start sticky right-0 bg-slate-50 dark:bg-slate-800/90 z-10 border-e border-slate-200 dark:border-slate-700/60 min-w-[120px]">
                  {isRTL ? 'نوع المساحة' : 'Space Type'}
                </th>
                {hoursList.map(h => (
                  <th key={h} className="py-4 px-3 min-w-[90px] border-e border-slate-100 dark:border-slate-800 last:border-e-0">
                    <span className="block text-sm font-black">{h} {isRTL ? 'ساعة' : 'H'}</span>
                    <span className="text-[10px] font-medium text-slate-400">{h} {h === 1 ? 'Hour' : 'Hours'}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {SUPPORTED_SPACE_TYPES.map((space) => {
                const isCurrentActive = selectedSpace === space.key;
                return (
                  <tr 
                    key={space.key}
                    className={cn(
                      "transition-colors",
                      isCurrentActive 
                        ? "bg-cyan-50/40 dark:bg-cyan-950/20" 
                        : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    )}
                  >
                    <td className="py-4 px-4 text-start font-black text-slate-900 dark:text-white sticky right-0 bg-white dark:bg-slate-900 z-10 border-e border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white">{space.labelEn}</span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {ROOM_TYPE_LABELS[space.key]?.[isRTL ? 'ar' : 'en']}
                        </span>
                      </div>
                    </td>

                    {hoursList.map(h => {
                      const priceVal = currentPricingRules[space.key]?.[h] ?? DEFAULT_PRICING_TABLE[space.key]?.[h] ?? 0;
                      const isHighlighted = isCurrentActive && selectedHours === h;

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
                              value={priceVal}
                              onChange={(e) => handleMatrixCellChange(space.key, h, parseFloat(e.target.value) || 0)}
                              className={cn(
                                "w-20 h-9 text-center font-black text-sm rounded-xl border-transparent focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950 transition-all",
                                isHighlighted 
                                  ? "bg-cyan-500 text-white font-black shadow-sm" 
                                  : "bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-100"
                              )}
                            />
                          </div>
                        </td>
                      );
                    })}
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
                {t('settings.pricing')} (General Parameters)
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

    </div>
  );
}
