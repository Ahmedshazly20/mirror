import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingBag,
  Clock,
  Printer,
  FileText,
  CreditCard,
  Banknote,
  Sparkles,
  UserCheck,
  Tag,
  Percent,
} from 'lucide-react';
import { formatCurrency, toMillis } from '../../../lib/utils-workspace';
import { printProductOrderReceipt } from '../utils/printReceipt';
import { useWorkspaceStore } from '../../../store';
import { Payment } from '../../../types';

interface HistoryProductOrderDetailModalProps {
  payment: Payment | null;
  isOpen: boolean;
  onClose: () => void;
  dateLocale: any;
}

export const HistoryProductOrderDetailModal = React.memo(function HistoryProductOrderDetailModal({
  payment,
  isOpen,
  onClose,
  dateLocale,
}: HistoryProductOrderDetailModalProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language.startsWith('ar');
  const customers = useWorkspaceStore((state) => state.customers);

  if (!payment) return null;

  const linkedCustomer = customers?.find(
    (c) =>
      (payment.customerId && c.id === payment.customerId) ||
      (payment.customerPhone && c.phone === payment.customerPhone.trim()),
  );

  const txMillis = toMillis(payment.date ?? payment.createdAt);
  const items = payment.items || [];
  const discountTotal = payment.serviceDiscountTotal || 0;
  const computedSubtotal = items.reduce(
    (acc, item) => acc + (item.originalPrice ?? item.price) * (item.quantity || 1),
    0,
  );
  const subtotal = payment.subtotal ?? (computedSubtotal > 0 ? computedSubtotal : payment.amount);
  const isDefaultWalkIn =
    !payment.customerName || payment.customerName.trim() === 'عميل سريع';
  const customerDisplayName =
    linkedCustomer?.name ||
    (!isDefaultWalkIn ? payment.customerName : undefined) ||
    (isRTL ? 'عميل سريع' : 'Walk-in Customer');
  const customerPhone = payment.customerPhone || linkedCustomer?.phone;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white max-w-lg rounded-[2.5rem] max-h-[90vh] overflow-y-auto"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-black flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-amber-500" />
            <span>{isRTL ? 'تفاصيل طلب المنتجات' : 'Product Order Details'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Customer & Order Header */}
          <div className="flex items-center gap-4 p-5 rounded-[2rem] bg-amber-500/5 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-amber-500 text-white shadow-lg shadow-amber-500/20 shrink-0">
              <ShoppingBag className="w-7 h-7" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {linkedCustomer?.customerId && (
                  <span className="text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-lg font-mono">
                    #{linkedCustomer.customerId}
                  </span>
                )}
                <h3 className="text-xl font-black truncate">{customerDisplayName}</h3>
              </div>
              {customerPhone && (
                <p className="text-sm text-slate-500 font-medium font-mono mt-0.5">
                  {customerPhone}
                </p>
              )}
              <p className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-amber-500" />
                <span>{format(txMillis, 'MMMM do, yyyy · HH:mm', { locale: dateLocale })}</span>
              </p>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge className="bg-amber-500 text-white border-0 py-1 px-2.5 rounded-xl font-bold text-[10px]">
                {isRTL ? 'طلب منتجات' : 'Product Order'}
              </Badge>
              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                <Tag className="w-2.5 h-2.5" />
                {payment.id}
              </span>
            </div>
          </div>

          {/* Order Meta (Created By / Payment Reference) */}
          {payment.createdBy && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs">
              <span className="text-slate-500 font-bold flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                <span>{isRTL ? 'تم الإنشاء بواسطة:' : 'Created by:'}</span>
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{payment.createdBy}</span>
            </div>
          )}

          {/* Purchased Items Breakdown */}
          <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs font-black text-slate-600 dark:text-slate-300">
              <span>{isRTL ? 'المنتجات والكميات' : 'Purchased Items'}</span>
              <span className="font-mono text-amber-600 dark:text-amber-400">
                {items.reduce((sum, i) => sum + (i.quantity || 1), 0)} {isRTL ? 'قطعة' : 'items'}
              </span>
            </div>

            {items.length > 0 ? (
              <div className="space-y-2 pt-1">
                {items.map((item, idx) => {
                  const qty = item.quantity || 1;
                  const origUnit = item.originalPrice ?? item.price;
                  const lineTotal = item.price * qty;
                  const lineDiscount = item.discountAmount || 0;
                  const hasUnitDiscount =
                    item.originalPrice !== undefined && item.originalPrice > item.price;

                  return (
                    <div
                      key={`${item.id || item.name}-${idx}`}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                          {item.name}
                        </p>
                        <div className="flex items-center flex-wrap gap-2 text-[11px] text-slate-500 font-mono">
                          <span>
                            {qty} × {formatCurrency(item.price)}
                          </span>
                          {hasUnitDiscount && (
                            <span className="line-through text-slate-400">
                              {formatCurrency(origUnit)}
                            </span>
                          )}
                          {lineDiscount > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              (-{formatCurrency(lineDiscount)})
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-mono font-black text-slate-900 dark:text-white shrink-0">
                        {formatCurrency(lineTotal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-2">
                {isRTL ? 'لا توجد تفاصيل أصناف مسجلة' : 'No item details recorded'}
              </p>
            )}
          </div>

          {/* Pricing & Payment Summary */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold">
                {isRTL ? 'المجموع الفرعي (قبل الخصم)' : 'Subtotal'}
              </span>
              <span className="font-black text-slate-700 dark:text-slate-300 font-mono">
                {formatCurrency(subtotal)}
              </span>
            </div>

            {discountTotal > 0 && (
              <div className="flex justify-between items-center text-sm text-emerald-600 dark:text-emerald-400">
                <span className="font-bold flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'إجمالي الخصم' : 'Total Discount'}</span>
                </span>
                <span className="font-black font-mono">-{formatCurrency(discountTotal)}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-lg font-black">
                  {isRTL ? 'الإجمالي المدفوع' : 'Final Amount'}
                </span>
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatCurrency(payment.amount)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-500 font-medium pt-1">
                <span>{isRTL ? 'طريقة الدفع:' : 'Payment Method:'}</span>
                <span className="font-bold uppercase flex items-center gap-1.5">
                  {payment.paymentMethod === 'instapay' ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
                      <span>InstaPay</span>
                    </>
                  ) : payment.paymentMethod === 'card' ? (
                    <>
                      <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                      <span>Card</span>
                    </>
                  ) : (
                    <>
                      <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{isRTL ? 'كاش (Cash)' : 'Cash'}</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {payment.notes && (
            <div className="space-y-1.5 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
              <p className="text-[10px] text-amber-600 uppercase font-black tracking-widest flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> {isRTL ? 'ملاحظات الطلب' : 'Order Notes'}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 italic font-medium leading-relaxed">
                "{payment.notes}"
              </p>
            </div>
          )}
        </div>

        <div className="pt-4 flex gap-3">
          <Button
            variant="outline"
            className="h-14 px-5 rounded-2xl border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all active:scale-95 flex items-center gap-2 font-bold cursor-pointer"
            onClick={() => printProductOrderReceipt(payment)}
          >
            <Printer className="w-5 h-5" />
            {t('common.print')}
          </Button>

          <Button
            className="flex-1 bg-slate-900 border-0 hover:bg-slate-800 text-white h-14 rounded-2xl font-black text-lg shadow-xl shadow-slate-950/25 active:scale-95 transition-all cursor-pointer"
            onClick={onClose}
          >
            {t('sessions.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
