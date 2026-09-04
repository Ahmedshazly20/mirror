import React, { useState, useMemo } from 'react';
import { 
  Boxes, 
  Search, 
  Plus, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  Edit, 
  Trash2, 
  TrendingDown, 
  DollarSign, 
  Layers, 
  PackageCheck, 
  Clock, 
  FileText,
  Filter,
  ShieldAlert,
  Lock
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useWorkspaceStore } from '../store';
import { inventoryService } from '../services/inventoryService';
import { InventoryItem, InventoryMovement, StockMovementType } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export default function Inventory() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRTL = i18n.language.startsWith('ar');
  const dateLocale = isRTL ? ar : enUS;

  const { inventoryItems, inventoryMovements, user } = useWorkspaceStore();
  const isOwner = user?.role === 'owner';

  const [searchTerm, setSearchTerm] = useState('');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Form State for Inventory Item
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('piece');
  const [currentStock, setCurrentStock] = useState('0');
  const [minimumStock, setMinimumStock] = useState('5');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Restock / Movement Modal State
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedItemForMovement, setSelectedItemForMovement] = useState<InventoryItem | null>(null);
  const [movementType, setMovementType] = useState<StockMovementType>('restock');
  const [movementQty, setMovementQty] = useState('1');
  const [movementNotes, setMovementNotes] = useState('');

  // Filtered inventory
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return inventoryItems;
    const term = searchTerm.toLowerCase().trim();
    return inventoryItems.filter(item => 
      item.name.toLowerCase().includes(term) ||
      (item.sku && item.sku.toLowerCase().includes(term))
    );
  }, [inventoryItems, searchTerm]);

  // Low stock items list
  const lowStockItems = useMemo(() => {
    return inventoryItems.filter(i => i.currentStock <= i.minimumStock);
  }, [inventoryItems]);

  const handleOpenAddModal = () => {
    if (!isOwner) {
      toast.error(isRTL ? 'عفواً، هذه الصلاحية للمدير (Owner) فقط' : 'Only Owners can add inventory items');
      return;
    }
    setEditingItem(null);
    setName('');
    setSku('');
    setUnit('piece');
    setCurrentStock('0');
    setMinimumStock('5');
    setPurchasePrice('0');
    setSellingPrice('0');
    setIsItemModalOpen(true);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    if (!isOwner) {
      toast.error(isRTL ? 'عفواً، هذه الصلاحية للمدير (Owner) فقط' : 'Only Owners can edit inventory items');
      return;
    }
    setEditingItem(item);
    setName(item.name);
    setSku(item.sku || '');
    setUnit(item.unit || 'piece');
    setCurrentStock(item.currentStock.toString());
    setMinimumStock(item.minimumStock.toString());
    setPurchasePrice(item.purchasePrice.toString());
    setSellingPrice(item.sellingPrice.toString());
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      toast.error(isRTL ? 'عفواً، هذه الصلاحية للمدير (Owner) فقط' : 'Only Owners can modify inventory');
      return;
    }
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingItem) {
        await inventoryService.updateInventoryItem(editingItem.id, {
          name: name.trim(),
          sku: sku.trim(),
          unit,
          currentStock: parseFloat(currentStock) || 0,
          minimumStock: parseFloat(minimumStock) || 0,
          purchasePrice: parseFloat(purchasePrice) || 0,
          sellingPrice: parseFloat(sellingPrice) || 0,
        });
        toast.success(isRTL ? 'تم تحديث بيانات الصنف بنجاح' : 'Inventory item updated successfully');
      } else {
        await inventoryService.addInventoryItem({
          name: name.trim(),
          sku: sku.trim(),
          unit,
          currentStock: parseFloat(currentStock) || 0,
          minimumStock: parseFloat(minimumStock) || 0,
          purchasePrice: parseFloat(purchasePrice) || 0,
          sellingPrice: parseFloat(sellingPrice) || 0,
          active: true
        });
        toast.success(isRTL ? 'تمت إضافة الصنف إلى المخزن وقائمة الخدمات' : 'Item added to inventory & services');
      }
      setIsItemModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'حدث خطأ أثناء حفظ الصنف' : 'Failed to save item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!isOwner) {
      toast.error(isRTL ? 'عفواً، هذه الصلاحية للمدير (Owner) فقط' : 'Only Owners can delete inventory items');
      return;
    }
    if (confirm(isRTL ? 'هل أنت متأكد من حذف هذا المنتج من المخزن؟' : 'Delete this inventory item?')) {
      try {
        await inventoryService.deleteInventoryItem(id);
        toast.success(isRTL ? 'تم حذف الصنف من المخزن' : 'Item deleted from inventory');
      } catch (e) {
        toast.error(isRTL ? 'فشل حذف الصنف' : 'Failed to delete item');
      }
    }
  };

  const handleOpenMovementModal = (item: InventoryItem, defaultType: StockMovementType = 'restock') => {
    if (!isOwner) {
      toast.error(isRTL ? 'عفواً، تسجيل حركات المخزن وتوريد البضاعة للمدير فقط' : 'Only Owners can record stock movements');
      return;
    }
    setSelectedItemForMovement(item);
    setMovementType(defaultType);
    setMovementQty('1');
    setMovementNotes('');
    setIsMovementModalOpen(true);
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      toast.error(isRTL ? 'عفواً، هذه الصلاحية للمدير فقط' : 'Only Owners can record stock movements');
      return;
    }
    if (!selectedItemForMovement) return;
    const qty = parseFloat(movementQty);
    if (isNaN(qty) || qty <= 0) return;

    try {
      await inventoryService.recordStockMovement(
        selectedItemForMovement.id,
        movementType,
        qty,
        'manual',
        '',
        movementNotes
      );
      toast.success(isRTL ? 'تم تسجيل حركة المخزون بنجاح' : 'Stock movement recorded');
      setIsMovementModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(isRTL ? 'فشل تسجيل حركة المخزون' : 'Failed to record movement');
    }
  };

  // If not owner, show Access Denied Screen (identical security protection to Settings)
  if (!isOwner) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {isRTL ? 'صلاحيات وصول مقيدة' : 'Access Restricted'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isRTL 
                ? 'إدارة المخزن وإضافة الأصناف وتعديل الكميات متاحة فقط لحساب المدير (Owner).' 
                : 'Inventory management and stock modifications are restricted to Owner accounts only.'}
            </p>
          </div>
          <Button 
            onClick={() => navigate('/')}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl h-11 font-bold shadow-md hover:opacity-90 cursor-pointer"
          >
            {isRTL ? 'العودة للوحة التحكم' : 'Return to Dashboard'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isRTL ? 'إدارة المخزن والمنتجات' : 'Inventory Management'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isRTL ? 'متابعة كميات الأصناف، إعادة الملء، وتنبيهات انخفاض المخزون' : 'Track product quantities, restocking & stock alerts'}
            </p>
          </div>
        </div>

        <Button 
          onClick={handleOpenAddModal}
          className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-5 h-11 font-semibold shadow-lg shadow-purple-500/20 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>{isRTL ? 'إضافة صنف جديد' : 'Add Inventory Item'}</span>
        </Button>
      </div>

      {/* Low Stock Banner Alert */}
      {lowStockItems.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-amber-600 dark:text-amber-400">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 animate-bounce" />
            <div>
              <p className="font-bold text-sm">
                {isRTL 
                  ? `تنبيه: يوجد ${lowStockItems.length} صنف وصل للحد الأدنى من المخزون!` 
                  : `Alert: ${lowStockItems.length} items reached low stock level!`}
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                {lowStockItems.map(i => i.name).join(' ، ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{isRTL ? 'إجمالي الأصناف' : 'Total Items'}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{inventoryItems.length}</p>
          </div>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{isRTL ? 'أصناف تحتاج إعادة ملء' : 'Low Stock Items'}</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{lowStockItems.length}</p>
          </div>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{isRTL ? 'إجمالي حركات المخزون' : 'Total Movements'}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{inventoryMovements.length}</p>
          </div>
        </Card>
      </div>

      {/* Main Tabs: Items vs Movement Logs */}
      <Tabs defaultValue="items" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <TabsList className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-1">
            <TabsTrigger value="items" className="rounded-lg text-xs font-bold px-4">
              {isRTL ? 'جدول الأصناف' : 'Inventory Items'}
            </TabsTrigger>
            <TabsTrigger value="movements" className="rounded-lg text-xs font-bold px-4">
              {isRTL ? 'سجل حركات المخزن' : 'Stock Movements'}
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-72">
            <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none", isRTL ? 'right-3' : 'left-3')} />
            <Input 
              placeholder={isRTL ? 'بحث اسم الصنف...' : 'Search product...'} 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn("bg-white dark:bg-slate-900 rounded-xl h-10 border-slate-200/80 dark:border-slate-800 text-xs", isRTL ? 'pr-9' : 'pl-9')}
            />
          </div>
        </div>

        {/* Tab 1: Inventory Items Table */}
        <TabsContent value="items">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200/80 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">{isRTL ? 'اسم الصنف' : 'Item Name'}</th>
                    <th className="px-5 py-3.5 text-center">{isRTL ? 'الوحدة' : 'Unit'}</th>
                    <th className="px-5 py-3.5 text-center">{isRTL ? 'المخزون الحالي' : 'Current Stock'}</th>
                    <th className="px-5 py-3.5 text-center">{isRTL ? 'الحد الأدنى' : 'Min Stock'}</th>
                    <th className="px-5 py-3.5 text-center">{isRTL ? 'سعر الشراء' : 'Cost Price'}</th>
                    <th className="px-5 py-3.5 text-center">{isRTL ? 'سعر البيع' : 'Sell Price'}</th>
                    <th className="px-5 py-3.5 text-center">{isRTL ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                        {isRTL ? 'لا توجد أصناف مسجلة بالمخزن' : 'No inventory items found'}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isLow = item.currentStock <= item.minimumStock;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span>{item.name}</span>
                              {isLow && (
                                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px]">
                                  {isRTL ? 'منخفض' : 'Low'}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center text-slate-500 uppercase text-xs">
                            {item.unit}
                          </td>
                          <td className="px-5 py-4 text-center font-bold text-base">
                            <span className={cn(isLow ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white')}>
                              {item.currentStock}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center font-medium text-slate-400">
                            {item.minimumStock}
                          </td>
                          <td className="px-5 py-4 text-center font-semibold text-slate-600 dark:text-slate-300">
                            {item.purchasePrice} {t('common.currency')}
                          </td>
                          <td className="px-5 py-4 text-center font-bold text-purple-600 dark:text-purple-400">
                            {item.sellingPrice} {t('common.currency')}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => handleOpenMovementModal(item, 'restock')}
                                className="h-8 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900"
                              >
                                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                <span>{isRTL ? 'شحن / ملء' : 'Restock'}</span>
                              </Button>

                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg"
                                onClick={() => handleOpenEditModal(item)}
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>

                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-rose-500 hover:text-rose-600 rounded-lg"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Stock Movements History */}
        <TabsContent value="movements">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200/80 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">{isRTL ? 'التاريخ والوقت' : 'Date & Time'}</th>
                    <th className="px-5 py-3.5">{isRTL ? 'الصنف' : 'Product'}</th>
                    <th className="px-5 py-3.5 text-center">{isRTL ? 'نوع الحركة' : 'Type'}</th>
                    <th className="px-5 py-3.5 text-center">{isRTL ? 'الكمية' : 'Quantity'}</th>
                    <th className="px-5 py-3.5 text-center">{isRTL ? 'المخزون (قبل → بعد)' : 'Stock Shift'}</th>
                    <th className="px-5 py-3.5">{isRTL ? 'ملاحظات' : 'Notes'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {inventoryMovements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                        {isRTL ? 'لا يوجد حركات مسجلة' : 'No stock movements logged'}
                      </td>
                    </tr>
                  ) : (
                    inventoryMovements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 text-xs">
                        <td className="px-5 py-3.5 text-slate-500 font-medium">
                          {format(new Date(m.createdAt), 'dd MMMM yyyy - HH:mm', { locale: dateLocale })}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                          {m.inventoryItemName || '---'}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "capitalize text-[10px] font-bold",
                              m.type === 'restock' && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                              m.type === 'sale' && "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
                              m.type === 'waste' && "bg-rose-500/10 text-rose-600 border-rose-500/20"
                            )}
                          >
                            {m.type}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-center font-bold">
                          {m.type === 'restock' || m.type === 'return' ? `+${m.quantity}` : `-${m.quantity}`}
                        </td>
                        <td className="px-5 py-3.5 text-center font-mono text-slate-500">
                          {m.previousStock} → <span className="font-bold text-slate-900 dark:text-white">{m.newStock}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {m.notes || '---'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Inventory Item Dialog */}
      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingItem 
                ? (isRTL ? 'تعديل بيانات الصنف' : 'Edit Inventory Item') 
                : (isRTL ? 'إضافة صنف جديد للمخزن' : 'Add Inventory Item')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveItem} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRTL ? 'اسم الصنف / المنتج *' : 'Product Name *'}
              </label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder={isRTL ? 'مثال: كولا / كانز / شاي' : 'e.g. Cola Can / Tea'}
                className="rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">SKU / الكود</label>
                <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="BEV-001" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">الوحدة Unit</label>
                <select 
                  value={unit} 
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm"
                >
                  <option value="piece">{isRTL ? 'قطعة (Piece)' : 'Piece'}</option>
                  <option value="can">{isRTL ? 'كانز (Can)' : 'Can'}</option>
                  <option value="bottle">{isRTL ? 'زجاجة (Bottle)' : 'Bottle'}</option>
                  <option value="pack">{isRTL ? 'عبوة / علبة (Pack)' : 'Pack'}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'المخزون الحالي' : 'Current Stock'}
                </label>
                <Input type="number" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'الحد الأدنى للتنبيه' : 'Minimum Stock Alert'}
                </label>
                <Input type="number" value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} className="rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'سعر الشراء / التكلفة' : 'Cost Price'}
                </label>
                <Input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isRTL ? 'سعر البيع للعميل' : 'Selling Price'}
                </label>
                <Input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="rounded-xl" />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsItemModalOpen(false)} className="rounded-xl">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl">
                {isRTL ? 'حفظ' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Movement / Restock Modal */}
      <Dialog open={isMovementModalOpen} onOpenChange={setIsMovementModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {isRTL ? `تسجيل حركة مخزن - ${selectedItemForMovement?.name}` : `Stock Movement - ${selectedItemForMovement?.name}`}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleRecordMovement} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRTL ? 'نوع الحركة' : 'Movement Type'}
              </label>
              <select 
                value={movementType} 
                onChange={(e: any) => setMovementType(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm"
              >
                <option value="restock">{isRTL ? 'شحن / توريد جديد (Restock)' : 'Restock'}</option>
                <option value="adjustment">{isRTL ? 'تسوية مخزون (Adjustment)' : 'Adjustment'}</option>
                <option value="waste">{isRTL ? 'هالك / تالف (Waste)' : 'Waste'}</option>
                <option value="return">{isRTL ? 'مرتجع (Return)' : 'Return'}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRTL ? 'الكمية *' : 'Quantity *'}
              </label>
              <Input 
                type="number" 
                value={movementQty} 
                onChange={(e) => setMovementQty(e.target.value)} 
                min="1"
                className="rounded-xl font-bold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isRTL ? 'ملاحظات الحركة' : 'Movement Notes'}
              </label>
              <Input 
                value={movementNotes} 
                onChange={(e) => setMovementNotes(e.target.value)} 
                placeholder={isRTL ? 'مثلاً: فاتورة توريد رقم...' : 'Notes...'}
                className="rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsMovementModalOpen(false)} className="rounded-xl">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl">
                {isRTL ? 'تأكيد التسجيل' : 'Confirm'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
