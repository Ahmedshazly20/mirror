import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Boxes, AlertCircle, CheckCircle2 } from 'lucide-react';
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
import { useWorkspaceStore } from '../../../store';
import { formatCurrency } from '../../../lib/utils-workspace';
import { inventoryService } from '../../../services/inventoryService';
import { cn } from '@/lib/utils';
import { ServiceItem } from '../../../types';
import { toast } from 'sonner';

interface ActiveAddServiceModalProps {
  sessionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onAdd: (sessionId: string, service: ServiceItem, quantity: number) => Promise<void>;
}

export const ActiveAddServiceModal = React.memo(function ActiveAddServiceModal({
  sessionId,
  isOpen,
  onClose,
  onAdd
}: ActiveAddServiceModalProps) {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceQty, setServiceQty] = useState('1');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableServices = useWorkspaceStore(state => state.availableServices);
  const inventoryItems = useWorkspaceStore(state => state.inventoryItems);
  const isRTL = i18n.language.startsWith('ar');

  const filteredServices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return availableServices;
    return availableServices.filter(s => 
      s.name.toLowerCase().includes(q) ||
      (s.category && s.category.toLowerCase().includes(q))
    );
  }, [availableServices, searchQuery]);

  const handleServiceClick = async (service: ServiceItem) => {
    if (!sessionId || isSubmitting) return;

    const linkedInv = inventoryService.findInventoryItemForService(service, inventoryItems);
    const qty = Math.max(1, parseInt(serviceQty) || 1);

    if (linkedInv) {
      const stock = Number(linkedInv.currentStock) || 0;
      if (stock <= 0) {
        toast.error(isRTL ? `عفوًا، صنف "${service.name}" نفد من المخزون تمامًا (0 متاح)!` : `Sorry, "${service.name}" is out of stock!`);
        return;
      }
      if (qty > stock) {
        toast.error(isRTL ? `الكمية المطلوبة (${qty}) تتجاوز المخزون المتاح حاليًا (${stock})!` : `Requested quantity (${qty}) exceeds available stock (${stock})!`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onAdd(sessionId, service, qty);
      setSearchQuery('');
      setServiceQty('1');
      setSelectedServiceId(null);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2">
            <Boxes className="w-5 h-5 text-purple-500" />
            <span>{isRTL ? 'إضافة خدمة / طلب للعميل' : t('sessions.addService')}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quantity setting at top for convenience */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70">
            <Label htmlFor="qty" className="text-xs font-black text-slate-700 dark:text-slate-300">
              {isRTL ? 'الكمية المراد إضافتها:' : t('sessions.quantity')}
            </Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setServiceQty(prev => String(Math.max(1, (parseInt(prev) || 1) - 1)))}
                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-black text-sm flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-95 transition-all"
              >
                -
              </button>
              <Input 
                id="qty" 
                type="number" 
                min="1"
                value={serviceQty}
                onChange={(e) => setServiceQty(e.target.value)}
                className="w-16 h-8 text-center bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-black text-sm rounded-xl"
              >
              </Input>
              <button
                type="button"
                onClick={() => setServiceQty(prev => String((parseInt(prev) || 1) + 1))}
                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-black text-sm flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-95 transition-all"
              >
                +
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className={cn(
              "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400",
              isRTL ? 'right-3' : 'left-3'
            )} />
            <input
              placeholder={isRTL ? 'ابحث باسم الخدمة أو المشروب...' : t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm font-medium",
                isRTL ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'
              )}
            />
          </div>
          
          <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
            {filteredServices.map(service => {
              const linkedInv = inventoryService.findInventoryItemForService(service, inventoryItems);
              const currentStock = linkedInv ? Number(linkedInv.currentStock) || 0 : null;
              const isOutOfStock = currentStock !== null && currentStock <= 0;

              return (
                <button
                  key={service.id}
                  type="button"
                  disabled={isOutOfStock || isSubmitting}
                  onClick={() => handleServiceClick(service)}
                  className={cn(
                    "w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-150 text-right group",
                    isOutOfStock
                      ? "bg-slate-100/70 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed"
                      : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 hover:border-purple-500/50 hover:bg-purple-500/5 active:scale-[0.99] cursor-pointer"
                  )}
                >
                  <div className={cn("flex-1 min-w-0", isRTL ? 'text-right' : 'text-left')}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn(
                        "text-sm font-bold truncate",
                        isOutOfStock ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-900 dark:text-white"
                      )}>
                        {service.name}
                      </p>

                      {/* Live Stock Indicator Badge */}
                      {currentStock !== null ? (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] font-black px-2 py-0.5 rounded-md border",
                            isOutOfStock 
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                              : currentStock <= (linkedInv?.minimumStock || 3)
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          )}
                        >
                          {isOutOfStock ? (
                            <span>{isRTL ? 'نفد المخزون' : 'Out of Stock'}</span>
                          ) : (
                            <span>{isRTL ? `المتاح: ${currentStock} ${linkedInv?.unit || ''}` : `Stock: ${currentStock}`}</span>
                          )}
                        </Badge>
                      ) : null}
                    </div>

                    <p className="text-[11px] text-slate-400 mt-0.5 capitalize">
                      {t(`common.${service.category}`, service.category || 'drinks')}
                    </p>
                  </div>

                  <div className={cn("shrink-0", isRTL ? 'text-left mr-3' : 'text-right ml-3')}>
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(service.price)}
                    </p>
                    <span className={cn(
                      "text-[10px] font-bold block transition-colors",
                      isOutOfStock ? "text-rose-400" : "text-purple-500 group-hover:text-purple-600"
                    )}>
                      {isOutOfStock ? (isRTL ? 'غير متاح' : 'Unavailable') : (isRTL ? '+ إضافة طلب' : '+ Add')}
                    </span>
                  </div>
                </button>
              );
            })}

            {filteredServices.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                <Boxes className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>{t('sessions.noServices')}</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={isSubmitting}
            className="w-full border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl h-11 font-bold"
          >
            {t('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
