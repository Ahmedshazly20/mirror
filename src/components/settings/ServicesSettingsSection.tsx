import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Coffee, 
  Plus, 
  Percent, 
  ToggleLeft, 
  ToggleRight, 
  Trash2, 
  Tag, 
  ShoppingBag, 
  Sparkles, 
  Boxes, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { WorkspaceSettings, ServiceItem, InventoryItem } from '../../types';
import { serviceItemService } from '../../services/serviceItemService';
import { inventoryService } from '../../services/inventoryService';
import { useWorkspaceStore } from '../../store';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface ServicesSettingsSectionProps {
  localSettings: WorkspaceSettings;
  setLocalSettings: React.Dispatch<React.SetStateAction<WorkspaceSettings>>;
  availableServices: ServiceItem[];
}

export function ServicesSettingsSection({ localSettings, setLocalSettings, availableServices }: ServicesSettingsSectionProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language.startsWith('ar');
  const inventoryItems = useWorkspaceStore(state => state.inventoryItems);

  const [isAddingService, setIsAddingService] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  
  const [newService, setNewService] = useState({
    name: '',
    price: 0,
    category: 'drinks',
    inventoryItemId: ''
  });

  const [editForm, setEditForm] = useState({
    name: '',
    price: 0,
    category: 'drinks',
    inventoryItemId: ''
  });

  const categories = ['drinks', 'food', 'snacks', 'other'];

  const handleSyncWithInventory = async () => {
    setIsSyncing(true);
    try {
      await serviceItemService.syncAllFromInventory();
      toast.success(isRTL ? 'تمت مزامنة جميع أصناف المخزون مع قائمة الخدمات بنجاح' : 'All inventory items synced with services successfully');
    } catch {
      toast.error(t('common.error'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSelectInventoryItemForNew = (itemId: string) => {
    if (!itemId) {
      setNewService(prev => ({ ...prev, inventoryItemId: '' }));
      return;
    }
    const inv = inventoryItems.find(i => i.id === itemId);
    if (inv) {
      let cat = 'drinks';
      const u = (inv.unit || '').toLowerCase();
      if (u.includes('food') || u.includes('meal') || u.includes('وجبة')) cat = 'food';
      else if (u.includes('snack') || u.includes('سناك')) cat = 'snacks';

      setNewService({
        name: inv.name,
        price: inv.sellingPrice || 0,
        category: cat,
        inventoryItemId: inv.id
      });
    }
  };

  const handleAddService = async () => {
    if (!newService.name || newService.price < 0) return;
    try {
      await serviceItemService.addService({
        name: newService.name.trim(),
        price: Number(newService.price) || 0,
        category: newService.category || 'drinks',
        inventoryItemId: newService.inventoryItemId || undefined,
        inventoryComponents: newService.inventoryItemId 
          ? [{ inventoryItemId: newService.inventoryItemId, quantity: 1 }] 
          : undefined
      });
      setNewService({ name: '', price: 0, category: 'drinks', inventoryItemId: '' });
      setIsAddingService(false);
      toast.success(t('common.success'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleStartEdit = (service: ServiceItem) => {
    setEditingServiceId(service.id);
    setEditForm({
      name: service.name,
      price: service.price,
      category: service.category || 'drinks',
      inventoryItemId: service.inventoryItemId || ''
    });
  };

  const handleUpdateService = async () => {
    if (!editingServiceId || !editForm.name || editForm.price < 0) return;
    try {
      await serviceItemService.updateService(editingServiceId, {
        name: editForm.name.trim(),
        price: Number(editForm.price) || 0,
        category: editForm.category || 'drinks',
        inventoryItemId: editForm.inventoryItemId || undefined
      });
      setEditingServiceId(null);
      toast.success(t('common.success'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const removeService = async (id: string) => {
    try {
      await serviceItemService.deleteService(id);
      toast.success(t('common.success'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  return (
    <div className="space-y-8">
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm rounded-[2rem] overflow-hidden">
        <CardHeader className="p-8 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-900 dark:text-white">
                {t('settings.tabs.services')}
              </CardTitle>
              <CardDescription className="text-slate-500 font-medium">
                {isRTL 
                  ? 'إدارة الخدمات والمشروبات المربوطة بالمخزون وتحديد أسعار البيع' 
                  : 'Manage services & beverages linked with inventory and configure selling prices'}
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSyncWithInventory}
              disabled={isSyncing}
              className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl h-11 px-4 font-bold flex items-center gap-2"
            >
              <RefreshCw className={cn("w-4 h-4 text-purple-500", isSyncing && "animate-spin")} />
              <span>{isRTL ? 'مزامنة مع المخزون' : 'Sync Inventory'}</span>
            </Button>

            <Button 
              onClick={() => setIsAddingService(true)} 
              className="bg-cyan-500 hover:bg-cyan-600 text-white gap-2 rounded-2xl h-11 px-6 shadow-xl shadow-cyan-500/10 font-bold transition-all"
            >
              <Plus className="w-4 h-4" />
              {t('settings.addService')}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-8 pt-4 space-y-10">
          {/* Global Discount Section - Bento Highlight Style */}
          <div className="relative overflow-hidden p-8 rounded-[2rem] bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 border border-cyan-500/20 group">
             <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-700">
                <Percent className="w-32 h-32 text-cyan-600" />
             </div>
             
             <div className="relative z-10 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white dark:bg-slate-900 rounded-3xl flex items-center justify-center shadow-sm">
                      <Tag className="w-7 h-7 text-cyan-500" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900 dark:text-white leading-tight mb-1">{t('settings.globalDiscount')}</p>
                      <p className="text-xs text-slate-500 font-bold">{t('settings.globalDiscountDesc')}</p>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => setLocalSettings({
                      ...localSettings,
                      globalServiceDiscount: {
                        enabled: !(localSettings.globalServiceDiscount?.enabled),
                        percentage: localSettings.globalServiceDiscount?.percentage ?? 0
                      }
                    })}
                    className={cn(
                      "rounded-2xl h-12 px-6 gap-3 transition-all font-black uppercase text-[10px] tracking-widest",
                      localSettings.globalServiceDiscount?.enabled 
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                        : 'bg-slate-200 text-slate-500 dark:bg-slate-800'
                    )}
                  >
                    {localSettings.globalServiceDiscount?.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    {localSettings.globalServiceDiscount?.enabled ? t('common.active') : t('common.inactive')}
                  </Button>
                </div>
                
                <AnimatePresence>
                  {localSettings.globalServiceDiscount?.enabled && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 24 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-4 max-w-sm">
                        <Label className="text-xs font-black text-slate-400 uppercase tracking-widest shrink-0">
                          {t('settings.discountPercentage')}
                        </Label>
                        <div className="relative flex-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={localSettings.globalServiceDiscount.percentage}
                            onChange={(e) => setLocalSettings({
                              ...localSettings,
                              globalServiceDiscount: {
                                ...localSettings.globalServiceDiscount,
                                percentage: parseFloat(e.target.value) || 0
                              }
                            })}
                            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl h-12 font-black text-lg focus:ring-cyan-500/20 pr-12"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400">%</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          </div>

          <AnimatePresence>
            {isAddingService && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4 p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 shadow-inner"
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-5 h-5 text-purple-500" />
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {isRTL ? 'إضافة خدمة أو ربط صنف من المخزون' : 'Add Service or Link from Inventory'}
                    </span>
                  </div>
                  {inventoryItems.length > 0 && (
                    <span className="text-xs text-slate-500">
                      {isRTL ? 'يمكنك اختيار صنف موجود مسبقًا بالمخزون لتحديد سعر بيعه فقط' : 'Select an existing inventory item to set its selling price'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Select from Inventory */}
                  {inventoryItems.length > 0 && (
                    <div className="space-y-1.5 md:col-span-4">
                      <Label className="text-[11px] font-bold text-slate-500">
                        {isRTL ? 'اختر صنف من المخزون (اختياري):' : 'Pick from Inventory (Optional):'}
                      </Label>
                      <select
                        value={newService.inventoryItemId}
                        onChange={(e) => handleSelectInventoryItemForNew(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl h-11 font-bold px-4 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
                      >
                        <option value="">{isRTL ? '— خدمة مخصصة (أو اختر من المخزون أدناه) —' : '— Custom Service (or choose from inventory) —'}</option>
                        {inventoryItems.map(inv => (
                          <option key={inv.id} value={inv.id}>
                            {inv.name} (المخزون الحالي: {inv.currentStock} {inv.unit || ''}) — سعر البيع: {inv.sellingPrice} ج.م
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('common.name')}</Label>
                    <Input 
                      placeholder="شاي، قهوة، اسبريسو..."
                      value={newService.name}
                      onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl h-12 font-bold"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('settings.category')}</Label>
                    <select 
                      value={newService.category}
                      onChange={(e) => setNewService({ ...newService, category: e.target.value })}
                      className="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl h-12 font-bold px-4 outline-none focus:ring-2 focus:ring-cyan-500/20"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{t(`common.${cat}`, cat)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{isRTL ? 'سعر البيع للعميل (ج.م)' : 'Selling Price (EGP)'}</Label>
                    <Input 
                      type="number"
                      placeholder="0.00"
                      value={newService.price || ''}
                      onChange={(e) => setNewService({ ...newService, price: parseFloat(e.target.value) || 0 })}
                      className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl h-12 font-black text-lg text-emerald-600 dark:text-emerald-400"
                    />
                  </div>

                  <div className="flex items-end gap-2">
                    <Button onClick={handleAddService} className="bg-cyan-500 hover:bg-cyan-600 text-white flex-1 rounded-2xl h-12 font-bold shadow-lg shadow-cyan-500/10">
                      {t('common.add')}
                    </Button>
                    <Button onClick={() => setIsAddingService(false)} variant="ghost" className="rounded-2xl h-12 font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {availableServices.map((service) => {
                const linkedInv = inventoryService.findInventoryItemForService(service, inventoryItems);
                const currentStock = linkedInv ? linkedInv.currentStock : undefined;
                const isOutOfStock = currentStock !== undefined && currentStock <= 0;

                return (
                  <motion.div 
                    key={service.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "relative p-5 rounded-3xl transition-all duration-300 border-2 overflow-hidden",
                      editingServiceId === service.id 
                        ? "bg-white dark:bg-slate-900 border-cyan-500/30 shadow-xl" 
                        : "bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-indigo-500/30"
                    )}
                  >
                    {editingServiceId === service.id ? (
                      <div className="space-y-4">
                         <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                               <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('common.name')}</Label>
                               <Input 
                                 value={editForm.name}
                                 onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                 className="h-10 rounded-xl bg-white dark:bg-slate-900 font-bold"
                               />
                            </div>
                            <div className="space-y-1">
                               <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('settings.category')}</Label>
                               <select 
                                  value={editForm.category}
                                  onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                                  className="w-full h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 text-sm font-bold"
                               >
                                  {categories.map(cat => (
                                    <option key={cat} value={cat}>{t(`common.${cat}`, cat)}</option>
                                  ))}
                               </select>
                            </div>
                         </div>
                         <div className="flex items-center gap-3">
                            <div className="flex-1 space-y-1">
                               <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                 {isRTL ? 'سعر البيع (ج.م)' : 'Selling Price'}
                               </Label>
                               <Input 
                                 type="number"
                                 value={editForm.price}
                                 onChange={(e) => setEditForm({...editForm, price: parseFloat(e.target.value) || 0})}
                                 className="h-10 rounded-xl bg-white dark:bg-slate-900 font-black text-emerald-600 dark:text-emerald-400"
                               />
                            </div>
                            <div className="flex items-end gap-2 pt-4">
                               <Button onClick={handleUpdateService} size="sm" className="bg-emerald-500 text-white rounded-xl h-10 px-4 font-bold">
                                  {t('common.save')}
                               </Button>
                               <Button onClick={() => setEditingServiceId(null)} size="sm" variant="ghost" className="rounded-xl h-10 px-4 font-bold border border-slate-200 dark:border-slate-800">
                                  {t('common.cancel')}
                               </Button>
                            </div>
                         </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 group">
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 ring-4 ring-slate-100 dark:ring-slate-800 group-hover:scale-105 transition-transform duration-300 shrink-0">
                          <Coffee className="w-6 h-6 text-amber-500" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                             <p className="text-base font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight truncate">
                               {service.name}
                             </p>
                             <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-black uppercase text-slate-500 tracking-widest">
                                {t(`common.${service.category}`, service.category || 'drinks')}
                             </span>
                          </div>

                          <div className="flex items-center gap-3 flex-wrap">
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              {service.price} {t('common.currency')}
                            </p>

                            {/* Inventory Stock Badge */}
                            {currentStock !== undefined ? (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 border",
                                  isOutOfStock 
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" 
                                    : currentStock <= (linkedInv?.minimumStock || 5)
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                )}
                              >
                                <Boxes className="w-3 h-3" />
                                <span>
                                  {isRTL ? `المخزون: ${currentStock} ${linkedInv?.unit || ''}` : `Stock: ${currentStock}`}
                                </span>
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                {isRTL ? 'غير مربوط بالمخزن' : 'Unlinked'}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-all shrink-0">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleStartEdit(service)} 
                            className="text-cyan-500 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 rounded-xl"
                            title={isRTL ? 'تعديل السعر والبيانات' : 'Edit Price & Info'}
                          >
                            <Tag className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeService(service.id)} 
                            className="text-rose-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl"
                            title={isRTL ? 'حذف الخدمة' : 'Delete Service'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {availableServices.length === 0 && (
              <div className="col-span-full text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem]">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 grayscale opacity-40">
                   <Coffee className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{t('settings.noServicesAvailable')}</h3>
                <p className="text-slate-500 text-xs font-medium max-w-[250px] mx-auto mb-4">{t('settings.noServices')}</p>
                {inventoryItems.length > 0 && (
                  <Button
                    onClick={handleSyncWithInventory}
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs"
                  >
                    <Boxes className="w-4 h-4 mr-2" />
                    {isRTL ? 'سحب الأصناف من المخزون تلقائيًا' : 'Pull items from Inventory'}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Visual Accent - Stats/Hint */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="p-8 rounded-[2rem] bg-indigo-500 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-700">
               <Sparkles className="w-32 h-32" />
            </div>
            <h4 className="text-lg font-black mb-1">{isRTL ? 'الربط التلقائي مع المخزون' : 'Direct Inventory Link'}</h4>
            <p className="text-indigo-100 text-xs font-medium max-w-[300px]">
              {isRTL 
                ? 'أي صنف تضيفه في المخزون يظهر مباشرة هنا لتحديد سعر بيعه، وعند طلبه للعميل يُخصم تلقائيًا من المخزون.' 
                : 'Items added in Inventory appear here to set selling prices and automatically deduct stock upon sale.'}
            </p>
         </div>
         <div className="p-8 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-6">
            <div className="w-14 h-14 rounded-3xl bg-emerald-500/10 flex items-center justify-center shadow-inner">
               <Boxes className="w-7 h-7 text-emerald-500" />
            </div>
            <div>
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{isRTL ? 'إجمالي الخدمات والمنتجات' : 'Total Active Services'}</p>
               <p className="text-3xl font-black text-slate-900 dark:text-white">{availableServices.length}</p>
            </div>
         </div>
      </div>
    </div>
  );
}

