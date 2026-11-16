import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  Banknote,
  Sparkles,
  Printer,
  CheckCircle2,
  X,
  Boxes,
  Loader2,
  Percent
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '../store';
import { Customer, InventoryItem, PaymentOrderItem, ServiceItem } from '../types';
import { inventoryService } from '../services/inventoryService';
import { customerService } from '../services/customerService';
import { paymentService } from '../services/paymentService';
import { formatCurrency } from '../lib/utils-workspace';
import { printProductOrderReceipt } from '../features/sessions/utils/printReceipt';
import { toast } from 'sonner';

interface QuickOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CartItem {
  service: ServiceItem;
  quantity: number;
}

function getServiceAvailableStock(
  service: ServiceItem,
  inventoryItems: InventoryItem[]
): number | null {
  if (service.inventoryComponents && service.inventoryComponents.length > 0) {
    let minPossible: number | null = null;
    for (const comp of service.inventoryComponents) {
      const inv = inventoryItems.find(i => i.id === comp.inventoryItemId);
      if (inv) {
        const compUnit = Math.max(1, Number(comp.quantity) || 1);
        const possible = Math.floor((Number(inv.currentStock) || 0) / compUnit);
        minPossible = minPossible === null ? possible : Math.min(minPossible, possible);
      }
    }
    return minPossible;
  }

  const linked = inventoryService.findInventoryItemForService(service, inventoryItems);
  return linked ? Math.max(0, Number(linked.currentStock) || 0) : null;
}

export default function QuickOrderModal({ isOpen, onClose }: QuickOrderModalProps) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language.startsWith('ar');

  const {
    availableServices,
    inventoryItems,
    settings,
    customers,
    user
  } = useWorkspaceStore();

  // Catalog & cart state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay'>('cash');
  const [notes, setNotes] = useState('');
  const [shouldPrint, setShouldPrint] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Optional customer selection state
  const [customerSearch, setCustomerSearch] = useState('');
  const [remoteCustomers, setRemoteCustomers] = useState<Customer[]>([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [walkInName, setWalkInName] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Reset form when closing
  const resetState = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setCart([]);
    setPaymentMethod('cash');
    setNotes('');
    setCustomerSearch('');
    setRemoteCustomers([]);
    setSelectedCustomer(null);
    setWalkInName('');
    setShowCustomerDropdown(false);
  };

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  // Debounced customer search
  useEffect(() => {
    const term = customerSearch.trim();
    if (!term) {
      setRemoteCustomers([]);
      setIsSearchingCustomer(false);
      return;
    }

    const cleanTerm = term.replace(/^#/, '').trim();
    const isPureDigits = /^\d+$/.test(cleanTerm);
    if (term.length < 2 && !isPureDigits) {
      setRemoteCustomers([]);
      setIsSearchingCustomer(false);
      return;
    }

    setIsSearchingCustomer(true);
    const timer = setTimeout(async () => {
      try {
        const res = await customerService.searchCustomers(term, 8);
        setRemoteCustomers(res);
      } catch (_) {
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [customerSearch]);

  const suggestedCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return [];
    const cleanTerm = term.replace(/^#/, '');
    const map = new Map<string, Customer>();

    customers.forEach(c => {
      const matchId = c.customerId?.toString() === cleanTerm || c.customerId?.toString().includes(cleanTerm);
      const matchName = c.name.toLowerCase().includes(term);
      const matchPhone = c.phone.includes(cleanTerm) || c.phone.includes(term);
      if (matchId || matchName || matchPhone) {
        map.set(c.id, c);
      }
    });
    remoteCustomers.forEach(c => map.set(c.id, c));
    return Array.from(map.values()).slice(0, 6);
  }, [customers, remoteCustomers, customerSearch]);

  const activeProducts = useMemo(() => {
    return (availableServices || []).filter(s => s.active !== false);
  }, [availableServices]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    activeProducts.forEach(s => {
      if (s.category) cats.add(s.category);
    });
    return ['all', ...Array.from(cats)];
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeProducts.filter(s => {
      if (selectedCategory !== 'all' && s.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q))
      );
    });
  }, [activeProducts, selectedCategory, searchQuery]);

  const handleAddToCart = (service: ServiceItem) => {
    const availableStock = getServiceAvailableStock(service, inventoryItems);
    if (availableStock !== null && availableStock <= 0) {
      toast.error(isRTL ? `عفوًا، "${service.name}" نفد من المخزون` : `"${service.name}" is out of stock`);
      return;
    }

    setCart(prev => {
      const idx = prev.findIndex(item => item.service.id === service.id);
      if (idx >= 0) {
        const nextQty = prev[idx].quantity + 1;
        if (availableStock !== null && nextQty > availableStock) {
          toast.error(
            isRTL
              ? `المتاح في المخزون من "${service.name}" هو ${availableStock} فقط`
              : `Only ${availableStock} left in stock for "${service.name}"`
          );
          return prev;
        }
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: nextQty };
        return copy;
      }
      return [...prev, { service, quantity: 1 }];
    });
  };

  const handleUpdateQty = (serviceId: string, delta: number) => {
    setCart(prev => {
      const idx = prev.findIndex(item => item.service.id === serviceId);
      if (idx < 0) return prev;
      const item = prev[idx];
      const nextQty = item.quantity + delta;
      if (nextQty <= 0) {
        return prev.filter(c => c.service.id !== serviceId);
      }
      if (delta > 0) {
        const availableStock = getServiceAvailableStock(item.service, inventoryItems);
        if (availableStock !== null && nextQty > availableStock) {
          toast.error(
            isRTL
              ? `المتاح في المخزون من "${item.service.name}" هو ${availableStock} فقط`
              : `Only ${availableStock} left in stock for "${item.service.name}"`
          );
          return prev;
        }
      }
      const copy = [...prev];
      copy[idx] = { ...item, quantity: nextQty };
      return copy;
    });
  };

  const handleRemoveFromCart = (serviceId: string) => {
    setCart(prev => prev.filter(c => c.service.id !== serviceId));
  };

  // Pricing totals with globalServiceDiscount
  const discountConfig = settings.globalServiceDiscount;
  const discountPct = discountConfig?.enabled ? Math.max(0, Number(discountConfig.percentage) || 0) : 0;

  const { subtotal, serviceDiscountTotal, finalTotal, orderItems } = useMemo(() => {
    let sub = 0;
    let disc = 0;
    const items: PaymentOrderItem[] = cart.map(({ service, quantity }) => {
      const unitOriginal = Number(service.price) || 0;
      const unitDiscount = discountPct > 0 ? (unitOriginal * discountPct) / 100 : 0;
      const unitNet = Math.max(0, unitOriginal - unitDiscount);
      sub += unitOriginal * quantity;
      disc += unitDiscount * quantity;
      return {
        id: service.id,
        serviceId: service.id,
        inventoryItemId: service.inventoryItemId,
        name: service.name,
        price: Math.round(unitNet * 100) / 100,
        originalPrice: unitOriginal,
        discountAmount: Math.round(unitDiscount * quantity * 100) / 100,
        quantity
      };
    });

    const roundedSub = Math.round(sub * 100) / 100;
    const roundedDisc = Math.round(disc * 100) / 100;
    const netTotal = Math.max(0, Math.round((roundedSub - roundedDisc) * 100) / 100);

    return {
      subtotal: roundedSub,
      serviceDiscountTotal: roundedDisc,
      finalTotal: netTotal,
      orderItems: items
    };
  }, [cart, discountPct]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || isSubmitting) {
      toast.error(isRTL ? 'أضف منتجاً واحداً على الأقل لإتمام الطلب' : 'Add at least one product');
      return;
    }

    setIsSubmitting(true);
    try {
      const customerName = selectedCustomer
        ? selectedCustomer.name
        : walkInName.trim() || (isRTL ? 'عميل سريع' : 'Walk-in Customer');

      const createdPayment = await paymentService.createProductOrder({
        items: orderItems,
        subtotal,
        serviceDiscountTotal,
        amount: finalTotal,
        paymentMethod,
        customerId: selectedCustomer?.id,
        customerName,
        customerPhone: selectedCustomer?.phone,
        notes: notes.trim() || undefined,
        createdBy: user?.name || user?.email
      });

      if (shouldPrint) {
        printProductOrderReceipt(createdPayment);
      }

      toast.success(
        isRTL
          ? `تم تسجيل الطلب السريع بقيمة ${formatCurrency(finalTotal)} وخصم المخزون بنجاح`
          : `Quick order recorded for ${formatCurrency(finalTotal)}`
      );
      resetState();
      onClose();
    } catch (err: any) {
      console.error('Quick order error:', err);
      toast.error(err.message || (isRTL ? 'فشل تنفيذ الطلب السريع' : 'Failed to create quick order'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryLabels: Record<string, string> = {
    all: isRTL ? 'الكل' : 'All',
    drinks: isRTL ? 'مشروبات' : 'Drinks',
    food: isRTL ? 'أطعمة' : 'Food',
    snacks: isRTL ? 'سناكس' : 'Snacks'
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && !isSubmitting && onClose()}>
      <DialogContent
        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white sm:max-w-3xl rounded-3xl max-h-[92vh] overflow-y-auto p-6"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
          <DialogTitle className="text-xl font-black flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span>{isRTL ? 'طلب منتجات سريع (بدون جلسة)' : 'Quick Product Order (No Session)'}</span>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                {isRTL
                  ? 'بيع مباشر للمنتجات والمشروبات مع خصم المخزون وتسجيل الدفع بدون فتح جلسة أو عداد وقت'
                  : 'Direct product sale with automatic inventory deduction and payment recording'}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
          {/* Left Side: Catalog & Customer */}
          <div className="lg:col-span-7 space-y-4">
            {/* Optional Customer Selector */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2 relative">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-500" />
                  <span>{isRTL ? 'العميل (اختياري — افتراضي: عميل سريع)' : 'Customer (Optional — default Walk-in)'}</span>
                </Label>
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearch('');
                    }}
                    className="text-[10px] font-bold text-rose-500 hover:underline flex items-center gap-0.5"
                  >
                    <X className="w-3 h-3" />
                    {isRTL ? 'إلغاء الاختيار' : 'Clear'}
                  </button>
                )}
              </div>

              {selectedCustomer ? (
                <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/30">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0 text-[10px] font-mono">
                      #{selectedCustomer.customerId}
                    </Badge>
                    <span className="text-xs font-bold">{selectedCustomer.name}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">{selectedCustomer.phone}</span>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={customerSearch || walkInName}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onChange={e => {
                      setCustomerSearch(e.target.value);
                      setWalkInName(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    placeholder={isRTL ? 'ابحث بالاسم / الهاتف / #ID أو اتركه لعميل سريع...' : 'Search customer or leave blank for Walk-in...'}
                    className="h-9 text-xs rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  />
                  {isSearchingCustomer && (
                    <Loader2 className={cn('w-3.5 h-3.5 animate-spin text-amber-500 absolute top-2.5', isRTL ? 'left-2.5' : 'right-2.5')} />
                  )}

                  {showCustomerDropdown && suggestedCustomers.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {suggestedCustomers.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerSearch('');
                            setWalkInName('');
                            setShowCustomerDropdown(false);
                          }}
                          className="w-full px-3 py-2 flex items-center justify-between hover:bg-amber-500/10 text-xs transition-colors"
                        >
                          <div className={isRTL ? 'text-right' : 'text-left'}>
                            <p className="font-bold text-slate-900 dark:text-white">{c.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{c.phone}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">#{c.customerId}</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Product Search & Category Filter */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className={cn('w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2', isRTL ? 'right-3' : 'left-3')} />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={isRTL ? 'ابحث عن منتج أو مشروب...' : 'Search products or beverages...'}
                  className={cn('h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs', isRTL ? 'pr-9' : 'pl-9')}
                />
              </div>

              {categories.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors border cursor-pointer',
                        selectedCategory === cat
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      )}
                    >
                      {categoryLabels[cat] || cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
              {filteredProducts.map(service => {
                const stock = getServiceAvailableStock(service, inventoryItems);
                const isOut = stock !== null && stock <= 0;
                const inCart = cart.find(c => c.service.id === service.id)?.quantity || 0;

                return (
                  <button
                    key={service.id}
                    type="button"
                    disabled={isOut}
                    onClick={() => handleAddToCart(service)}
                    className={cn(
                      'p-2.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-1.5 relative',
                      isRTL ? 'text-right' : 'text-left',
                      isOut
                        ? 'bg-slate-100/70 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                        : inCart > 0
                          ? 'bg-amber-500/10 border-amber-500 shadow-sm cursor-pointer'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-amber-500/60 cursor-pointer'
                    )}
                  >
                    {inCart > 0 && (
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center shadow">
                        {inCart}
                      </span>
                    )}
                    <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                      {service.name}
                    </p>
                    <div className="flex items-center justify-between gap-1 pt-1">
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatCurrency(service.price)}
                      </span>
                      {stock !== null && (
                        <span className={cn(
                          'text-[9px] font-bold px-1.5 py-0.5 rounded',
                          isOut
                            ? 'bg-rose-500/10 text-rose-500'
                            : 'bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        )}>
                          {isOut ? (isRTL ? 'نفد' : 'Out') : `${stock}`}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-full py-10 text-center text-slate-400 text-xs">
                  <Boxes className="w-7 h-7 mx-auto mb-1.5 opacity-30" />
                  {isRTL ? 'لا توجد منتجات مطابقة' : 'No matching products'}
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Cart & Payment */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-amber-500" />
                  <span>{isRTL ? 'سلة الطلب السريع' : 'Order Cart'}</span>
                </h4>
                <Badge variant="outline" className="text-[10px] font-bold">
                  {cart.reduce((s, c) => s + c.quantity, 0)} {isRTL ? 'صنف' : 'items'}
                </Badge>
              </div>

              {/* Cart Items */}
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {cart.map(({ service, quantity }) => (
                  <div
                    key={service.id}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate text-slate-800 dark:text-slate-100">{service.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {formatCurrency(service.price)} × {quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(service.id, -1)}
                        className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center font-mono font-bold text-xs">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(service.id, 1)}
                        className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(service.id)}
                        className="w-6 h-6 rounded-lg text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {cart.length === 0 && (
                  <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    {isRTL ? 'اضغط على أي منتج لإضافته للطلب' : 'Click any product to add it'}
                  </div>
                )}
              </div>

              {/* Optional notes */}
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={isRTL ? 'ملاحظات الطلب (اختياري)...' : 'Order notes (optional)...'}
                className="h-9 text-xs rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              />

              {/* Payment Method */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={cn(
                    'py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                    paymentMethod === 'cash'
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'
                  )}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'كاش (Cash)' : 'Cash'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('instapay')}
                  className={cn(
                    'py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                    paymentMethod === 'instapay'
                      ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'
                  )}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>InstaPay</span>
                </button>
              </div>
            </div>

            {/* Totals & Submit */}
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              {serviceDiscountTotal > 0 && (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>{isRTL ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                    <span className="font-mono">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      {isRTL ? `خصم الخدمات (${discountPct}%):` : `Service Discount (${discountPct}%):`}
                    </span>
                    <span className="font-mono">-{formatCurrency(serviceDiscountTotal)}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                  {isRTL ? 'الإجمالي المطلوب:' : 'Total Due:'}
                </span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatCurrency(finalTotal)}
                </span>
              </div>

              <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={shouldPrint}
                  onChange={e => setShouldPrint(e.target.checked)}
                  className="rounded border-slate-300 accent-amber-500"
                />
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span>{isRTL ? 'طباعة إيصال الطلب تلقائياً' : 'Auto-print order receipt'}</span>
              </label>

              <DialogFooter className="gap-2 sm:gap-2 flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded-xl h-10 text-xs font-bold flex-1"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  type="submit"
                  disabled={cart.length === 0 || isSubmitting}
                  className="rounded-xl h-10 text-xs font-black bg-amber-500 hover:bg-amber-600 text-white flex-[2] shadow-lg shadow-amber-500/20"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className={cn('w-4 h-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
                      <span>{isRTL ? 'تأكيد البيع والتحصيل' : 'Complete Sale'}</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
